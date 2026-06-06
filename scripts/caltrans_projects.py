#!/usr/bin/env python3
"""
Caltrans — Early Development Project List (state highway project pipeline):
production-quality fetcher.

Standalone analysis/utility companion to the app's TypeScript ingestion
(src/lib/sources/caltrans.ts). Pulls the dataset from the California Open Data
Portal (CKAN / data.ca.gov) via the DataStore API and writes a clean table.

NOTE: the resource id is resolved at runtime from the dataset package, because
hard-coded resource ids on data.ca.gov go stale (the starter script's id no
longer exists).

Usage:
    pip install requests pandas openpyxl
    python scripts/caltrans_projects.py --format json --out caltrans_projects.json
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from typing import Any, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

CKAN_BASE = "https://data.ca.gov/api/3/action"
DEFAULT_SLUG = "early-development-project-list"
PAGE_SIZE = 1000
TIMEOUT = 30

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("caltrans")


def _session() -> requests.Session:
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
        raise RuntimeError(f"CKAN action '{action}' failed: {data.get('error')}")
    return data["result"]


def resolve_resource_id(session: requests.Session, slug: str) -> str:
    """Resolve the DataStore-active resource id from the dataset package."""
    result = _ckan(session, "package_show", id=slug)
    resources = result.get("resources", [])
    target = (
        next((r for r in resources if r.get("datastore_active") and "dictionary" not in str(r.get("name", "")).lower()), None)
        or next((r for r in resources if r.get("datastore_active")), None)
    )
    if not target:
        raise RuntimeError(f"No DataStore-active resource in package '{slug}'.")
    log.info("Resolved resource: %s (id=%s)", target.get("name"), target.get("id"))
    return target["id"]


def fetch_all(session: requests.Session, resource_id: str) -> "list[dict]":
    records: list[dict] = []
    offset = 0
    while True:
        result = _ckan(session, "datastore_search", resource_id=resource_id, limit=PAGE_SIZE, offset=offset)
        batch = result.get("records", [])
        records.extend(batch)
        log.info("Retrieved %d–%d…", offset, offset + len(batch))
        total = int(result.get("total", len(records)))
        offset += PAGE_SIZE
        if not batch or len(records) >= total:
            break
        time.sleep(0.3)  # politeness delay
    return records


def normalize(records: "list[dict]") -> "list[dict]":
    """Dedupe by ProjectID and keep the key project fields."""
    seen: set[str] = set()
    out: list[dict] = []
    for r in records:
        pid = str(r.get("ProjectID", "")).strip()
        if not pid or pid.lower() == "projectid" or pid in seen:
            continue
        seen.add(pid)
        out.append({
            "project_id": pid,
            "district": str(r.get("CaltransDistrict", "")).strip(),
            "county": str(r.get("County", "")).strip(),
            "route": str(r.get("Route", "")).strip(),
            "project_name": str(r.get("ProjectName", "")).strip(),
            "project_description": str(r.get("ProjectDescription", "")).strip(),
            "work_description": str(r.get("Work_Description", "")).strip(),
            "total_cost": str(r.get("TotalCost", "")).strip(),
            "total_cost_formatted": str(r.get("TotalCostFormatted", "")).strip(),
            "pid_status": str(r.get("PIDStatus", "")).strip(),
            "current_phase": str(r.get("Current_Phase", "")).strip(),
            "funding_type": str(r.get("PIDFundingType", "")).strip(),
            "target_rtl_fy": str(r.get("Target_RTL_FY", "")).strip(),
        })
    return out


def fetch_caltrans_projects(slug: str = DEFAULT_SLUG) -> "list[dict]":
    session = _session()
    log.info("🚀 Pulling Caltrans projects from data.ca.gov (dataset '%s')…", slug)
    resource_id = resolve_resource_id(session, slug)
    raw = fetch_all(session, resource_id)
    rows = normalize(raw)
    log.info("✅ %d raw record(s); %d after dedupe.", len(raw), len(rows))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch the Caltrans Early Development Project List.")
    parser.add_argument("--slug", default=DEFAULT_SLUG, help="CKAN dataset slug")
    parser.add_argument("--format", choices=("csv", "json", "xlsx"), default="json", help="Output format")
    parser.add_argument("--out", help="Output file path (default: stdout for json/csv)")
    args = parser.parse_args()

    try:
        rows = fetch_caltrans_projects(args.slug)
    except Exception as e:  # noqa: BLE001
        log.error("💥 Failed: %s", e)
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
        target = args.out or "caltrans_projects.xlsx"
        df.to_excel(target, index=False)
        log.info("Wrote %s", target)
    else:
        if args.out:
            df.to_csv(args.out, index=False)
            log.info("Wrote %s", args.out)
        else:
            df.to_csv(sys.stdout, index=False)

    log.info("Done: %d rows.", len(df))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
