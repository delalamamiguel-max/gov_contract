#!/usr/bin/env python3
"""
California DGS — Approved Non-Competitive Bids: production-quality fetcher.

Standalone analysis/utility companion to the app's TypeScript ingestion
(src/lib/sources/dgs.ts). Pulls the dataset from the California Open Data Portal
(CKAN / data.ca.gov) and writes a clean, deduped table.

Prefers the CKAN DataStore API (clean JSON, no spreadsheet parsing). Falls back
to downloading + parsing the XLSX only if the DataStore is unavailable.

Usage:
    pip install requests pandas openpyxl
    python scripts/dgs_ncb.py --format csv --out ncb.csv
    python scripts/dgs_ncb.py --format json
"""
from __future__ import annotations

import argparse
import logging
import sys
from typing import Any, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

CKAN_BASE = "https://data.ca.gov/api/3/action"
DEFAULT_SLUG = "dgs-approved-non-competitive-bids"
PAGE_SIZE = 100
TIMEOUT = 30

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("dgs_ncb")


def _session() -> requests.Session:
    """HTTP session with retries + backoff for resilience."""
    s = requests.Session()
    retry = Retry(total=4, backoff_factor=0.6, status_forcelist=(429, 500, 502, 503, 504))
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({"Accept": "application/json"})
    return s


def _ckan(session: requests.Session, action: str, **params: Any) -> dict:
    resp = session.get(f"{CKAN_BASE}/{action}", params=params, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(f"CKAN action '{action}' returned an unsuccessful response")
    return data["result"]


def resolve_resource(session: requests.Session, slug: str) -> dict:
    """Find the active NCB data file resource (skips the data dictionary)."""
    result = _ckan(session, "package_show", id=slug)
    resources = result.get("resources", [])

    def pick(pred) -> Optional[dict]:
        return next((r for r in resources if pred(r)), None)

    target = (
        pick(lambda r: r.get("datastore_active") and str(r.get("format", "")).upper() == "XLSX"
             and "dictionary" not in str(r.get("name", "")).lower())
        or pick(lambda r: r.get("datastore_active"))
        or pick(lambda r: str(r.get("format", "")).upper() == "XLSX")
    )
    if not target:
        raise RuntimeError("No suitable NCB data resource found in the dataset package.")
    return target


def fetch_via_datastore(session: requests.Session, resource_id: str) -> "list[dict]":
    """Paginate the CKAN DataStore API for all records."""
    records: list[dict] = []
    offset = 0
    while True:
        result = _ckan(session, "datastore_search", resource_id=resource_id, limit=PAGE_SIZE, offset=offset)
        batch = result.get("records", [])
        records.extend(batch)
        total = int(result.get("total", len(records)))
        offset += PAGE_SIZE
        if not batch or len(records) >= total:
            break
    return records


def fetch_via_xlsx(session: requests.Session, url: str) -> "list[dict]":
    """Fallback: stream-download the XLSX and parse with pandas."""
    import pandas as pd  # imported lazily so JSON-only runs don't require it

    local = "dgs_ncb_download.xlsx"
    with session.get(url, stream=True, timeout=TIMEOUT) as r:
        r.raise_for_status()
        with open(local, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    df = pd.read_excel(local)
    return df.to_dict(orient="records")


def normalize(records: "list[dict]") -> "list[dict]":
    """Drop the stray header row, dedupe by Number, keep the documented fields."""
    seen: set[str] = set()
    out: list[dict] = []
    for r in records:
        number = str(r.get("Number", "")).strip()
        if not number or number.lower() == "number":  # skip blanks + the header artifact
            continue
        if number in seen:
            continue
        seen.add(number)
        out.append({
            "number": number,
            "justification_type": str(r.get("Type", "")).strip(),
            "approved_on": str(r.get("Approved on", "")).strip(),
            "requesting_organization": str(r.get("Requesting Organization", "")).strip(),
            "contractor_or_commodity": str(r.get("Contractor or Commodity", "")).strip(),
            "original_amount": str(r.get("Total Original Contract Amount", "")).strip(),
            "amended_amount": str(r.get("Amended Contract Amount", "")).strip(),
            "acquisition_type": str(r.get("Acquisition Type", "")).strip(),
        })
    return out


def fetch_dgs_ncb(slug: str = DEFAULT_SLUG) -> "list[dict]":
    session = _session()
    log.info("Resolving dataset '%s' on data.ca.gov…", slug)
    resource = resolve_resource(session, slug)
    log.info("Resource: %s (format=%s, datastore_active=%s)",
             resource.get("name"), resource.get("format"), resource.get("datastore_active"))

    if resource.get("datastore_active"):
        raw = fetch_via_datastore(session, resource["id"])
    else:
        log.info("DataStore inactive — falling back to XLSX download.")
        raw = fetch_via_xlsx(session, resource["url"])

    rows = normalize(raw)
    log.info("Fetched %d raw record(s); %d after cleaning + dedupe.", len(raw), len(rows))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch the CA DGS Approved Non-Competitive Bids dataset.")
    parser.add_argument("--slug", default=DEFAULT_SLUG, help="CKAN dataset slug")
    parser.add_argument("--format", choices=("csv", "json", "xlsx"), default="csv", help="Output format")
    parser.add_argument("--out", help="Output file path (default: stdout for json/csv)")
    args = parser.parse_args()

    try:
        rows = fetch_dgs_ncb(args.slug)
    except Exception as e:  # noqa: BLE001 — top-level guard for a CLI tool
        log.error("Failed to fetch dataset: %s", e)
        return 1

    if not rows:
        log.warning("No rows returned.")
        return 0

    import pandas as pd
    df = pd.DataFrame(rows)

    if args.format == "json":
        out = df.to_json(orient="records", indent=2)
        (open(args.out, "w").write(out) if args.out else sys.stdout.write(out + "\n"))
    elif args.format == "xlsx":
        target = args.out or "dgs_ncb.xlsx"
        df.to_excel(target, index=False)
        log.info("Wrote %s", target)
    else:  # csv
        if args.out:
            df.to_csv(args.out, index=False)
            log.info("Wrote %s", args.out)
        else:
            df.to_csv(sys.stdout, index=False)

    log.info("Done: %d rows.", len(df))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
