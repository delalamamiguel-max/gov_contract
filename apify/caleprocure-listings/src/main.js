// Cal eProcure — Open Bids (listings + per-event enrichment) scraper.
//
// Drives the InFlight/PeopleSoft SPA at caleprocure.ca.gov:
//   1. Runs the public "Posted" (open) event search and extracts every distinct
//      bid from the results grid.
//   2. For each event, deep-links directly to the public event detail page
//      (https://caleprocure.ca.gov/event/{BU}/{eventId}) — the only way to reach
//      event details + attachments anonymously (clicking the grid does nothing
//      without a session, and the bid-comments page 403s on a direct GET).
//   3. From the detail page it harvests the full description, real end date,
//      buyer contact, UNSPSC codes and service-area counties, then opens
//      "View Event Package" to read the attachments table (file name +
//      description) from the bid-comments page.
//
// The {BU} (PeopleSoft Business Unit) is NOT exposed anywhere in the anonymous
// listing, so we map the event's department name → BU via DEPT_BU below. Events
// whose department we can't map (e.g. the "DGS - Statewide Procurement"
// aggregator) are still emitted from the listing, just without enrichment.
//
// Attachment *download* URLs are session-bound (/psc/.../viewredirect/{V2}…) and
// expire, so we deliberately store only the file name + description and link the
// user to the durable /event/{BU}/{eventId} page to download.
//
// Output item:
//   { eventId, name, department, endRaw, endDate, status, url,
//     description, contactEmail, unspscCodes[], counties[], attachments[] }

import { Actor } from 'apify';
import { chromium } from 'playwright';
import crypto from 'crypto';
import { createRequire } from 'module';

// CJS-only text extractors, loaded via createRequire (this file is ESM).
// pdf-parse must be imported from its lib entry to skip its debug harness.
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

const SEARCH_URL = 'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

// Department display name (lower-cased) → PeopleSoft Business Unit code. Kept in
// sync with src/app/api/caleprocure/[eventId]/route.ts. Used to build the public
// deep link /event/{BU}/{eventId}.
const DEPT_BU = {
  '22nd daa': '8540',
  'business & economic developmnt': '0509',
  'ca arts council': '8260',
  'ca conservation corps': '3340',
  'ca health benefit exchange': '4800',
  'ca school finance authority': '0985',
  'ca tahoe conservancy': '3125',
  'cal fire': '3540',
  'csu, bakersfield': '6610',
  'csu, channel islands': '6610',
  'csu channel islands': '6610',
  'csu, dominguez hills': '6610',
  'csu, east bay': '6610',
  'csu, fresno': '6610',
  'csu, fullerton': '6610',
  'csu, sacramento': '6610',
  'csu, san bernardino': '6610',
  'csu, san diego': '6610',
  'csu, sonoma': '6610',
  'correctional trng rehab aut': '5225',
  'dgs - statewide procurement': '7760',
  'department of cannabis control': '1111',
  'department of conservation': '3480',
  'department of consumer affairs': '1111',
  'department of education': '6100',
  'department of fish & wildlife': '3600',
  'department of general services': '7760',
  'department of human resources': '8380',
  'department of insurance': '0845',
  'department of justice': '0820',
  'department of motor vehicles': '2740',
  'department of public health': '4265',
  'department of rehabilitation': '5160',
  'department of social services': '5180',
  'department of state hospitals': '4440',
  'department of technology': '7502',
  'department of transportation': '2660',
  caltrans: '2660',
  'department of water resources': '3860',
  'dept of corrections & rehab': '5225',
  'dept of developmental services': '4300',
  'dept of food & agriculture': '8570',
  'department of food and agriculture': '8570',
  'dept of industrial relations': '7350',
  'dept of managed health care': '4150',
  'dept of parks & recreation': '3790',
  'dept of pesticide regulation': '3930',
  'dept of tax and fee admin': '7600',
  'dept of veterans affairs': '8955',
  'dept of the ca highway patrol': '2720',
  'california highway patrol': '2720',
  'dept. alcoholic beverage cntrl': '2100',
  'dept. toxic substances control': '3960',
  'employment development dept': '7100',
  'energy resources conservation': '3360',
  "env'l health hazard assessment": '3980',
  'exposition park': '3100',
  'first 5 california': '4250',
  'franchise tax board': '7730',
  'gov ofc serv and community eng': '0650',
  "gov's off of lnd use & clmt in": '0650',
  'hope for children trust acct': '0950',
  'high speed rail authority': '2665',
  'institute for regenerative med': '6445',
  'judicial branch': '0250',
  'military department': '8940',
  'ofc technology and solutions i': '0531',
  'office of emergency services': '0690',
  'office of energy infrastructur': '3355',
  'office of exposition park': '3100',
  "public employees' retirement": '7900',
  'public employees retirement': '7900',
  'public utilities commission': '8660',
  'sf bay conservation commission': '3820',
  'school for the deaf-riverside': '6100',
  'state air resources board': '3900',
  'state board of equalization': '0860',
  'state coastal conservancy': '3760',
  'state controller': '0840',
  'state dept hlth care services': '4260',
  "state teachers' retirement sys": '7920',
  'state water resources control': '3940',
  'statewide stpd': '7502',
  'superior court of san bernardi': '0250',
  'uc davis medical center': '6440',
  'uc santa cruz': '6440',
  ucla: '6440',
};

function buFor(dept) {
  return DEPT_BU[String(dept || '').trim().toLowerCase()] || null;
}

/** Parse "06/08/2026 8:00AM PDT" style strings into ISO. */
function parseEnd(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{2}\/\d{2}\/\d{4})\s*(.*)$/);
  if (!m) return null;
  const [, date, time] = m;
  const d = new Date(`${date} ${time}`.replace(/\s+/g, ' ').trim());
  if (!isNaN(d.getTime())) return d.toISOString();
  const d2 = new Date(date);
  return isNaN(d2.getTime()) ? null : d2.toISOString();
}

/**
 * Read the attachments table off the (already-open) bid-comments page. The grid
 * renders progressively, so we wait until the populated row count stabilises,
 * then pair each file name with its description WITHIN the same table row (global
 * index pairing drifts and PeopleSoft reuses the `…ATTACH_DESCR$n` ids elsewhere).
 */
async function readAttachments(page) {
  await page
    .waitForSelector('[id^="PV_ATTACH_WRK_SCM_DOWNLOAD$"], [name="ViewAttachmentsFileName"]', { timeout: 12000 })
    .catch(() => {});
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 30; i++) {
    const n = await page
      .evaluate(() => [...document.querySelectorAll('[name="ViewAttachmentsFileName"]')].filter((s) => (s.textContent || '').trim()).length)
      .catch(() => 0);
    if (n === last) {
      stable++;
      if (stable >= 3 && n > 0) break;
    } else {
      stable = 0;
      last = n;
    }
    await page.waitForTimeout(500);
  }
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr')].filter((r) => r.querySelector('[name="ViewAttachmentsFileName"]'));
    const out = [];
    const seen = new Set();
    for (const r of rows) {
      const fileEl = r.querySelector('[name="ViewAttachmentsFileName"]');
      const name = (fileEl && fileEl.textContent || '').trim();
      if (!name) continue;
      // The description sits in one of several elements in the same row; some are
      // present-but-empty (e.g. an empty ViewAttachmentsDescriptionSpan shadows a
      // populated PV_ATTACH_WRK_ATTACH_DESCR$ input). Take the first NON-empty.
      let description = '';
      for (const el of r.querySelectorAll(
        '[name="ViewAttachmentsDescriptionSpan"], span[id^="PV_ATTACH_WRK_ATTACH_DESCR$"], input[id^="PV_ATTACH_WRK_ATTACH_DESCR$"]'
      )) {
        const v = (el.value || el.textContent || '').trim();
        if (v) { description = v; break; }
      }
      const key = `${name}||${description}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // No durable URL: PeopleSoft download links are session-bound and expire.
      out.push({ name, description, url: '' });
    }
    return out;
  });
}

/**
 * Enrich one event by deep-linking to its public detail page and reading the
 * attachments off the Event Package / bid-comments page. Returns the extra
 * fields to merge onto the listing item. Best-effort: any failure (unknown BU,
 * PeopleSoft error page, timeout) returns an empty enrichment so the listing row
 * is still emitted.
 *
 * IMPORTANT: each event runs in its OWN browser context. Cal eProcure keeps the
 * "current event" in server-side session state keyed by cookie, so sharing one
 * context across concurrent events cross-contaminates the bid-comments page
 * (event A shows event B's attachments). An isolated context per event prevents
 * that; concurrency is bounded by the worker pool.
 */
async function enrichEvent(browser, item) {
  const eventId = String(item.eventId || '').trim();
  const bu = buFor(item.department);
  const empty = { url: null, description: null, contactEmail: null, unspscCodes: [], counties: [], attachments: [] };
  if (!eventId || !bu) return empty;

  const url = `https://caleprocure.ca.gov/event/${bu}/${encodeURIComponent(eventId)}`;
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    // Wait for either the detail page to render or an error page to settle.
    await page
      .waitForSelector('#RESP_INQ_DL0_WK_AUC_DOWNLOAD_PB, #unspscTable, #serviceAreaTable', { timeout: 20000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    if (/error\.aspx/.test(page.url())) {
      await ctx.close();
      return empty; // BU resolved to the wrong unit for this event.
    }

    // Rich detail fields from the event details page.
    const detail = await page.evaluate(() => {
      const t = document.body.innerText || '';
      const descM = t.match(
        /Description:\s*\n+([\s\S]*?)\n(?:View Event Package|View Vendor Ads|Contact Information|UNSPSC|Pre Bid|Contractor License)/i
      );
      const endM = t.match(/Event End Date:\s*\n+([^\n]+)/i);
      const emailM = t.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
      const unspsc = [...document.querySelectorAll('#unspscTable tr')]
        .slice(1)
        .map((r) => {
          const c = [...r.querySelectorAll('td')].map((x) => (x.textContent || '').trim());
          return c[0] ? c[0] : null;
        })
        .filter(Boolean);
      const counties = [...document.querySelectorAll('#serviceAreaTable tr')]
        .slice(1)
        .map((r) => {
          const c = [...r.querySelectorAll('td')].map((x) => (x.textContent || '').trim());
          return c[1] || null;
        })
        .filter(Boolean);
      return {
        description: descM ? descM[1].trim().replace(/\s+/g, ' ') : null,
        endRaw: endM ? endM[1].trim() : null,
        contactEmail: emailM ? emailM[0] : null,
        unspscCodes: unspsc,
        counties,
      };
    });

    // Open "View Event Package" → bid-comments page → attachments table.
    let attachments = [];
    const pkg = page.locator('#RESP_INQ_DL0_WK_AUC_DOWNLOAD_PB');
    if (await pkg.count().catch(() => 0)) {
      await pkg.click({ timeout: 12000, force: true }).catch(() => {});
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      attachments = await readAttachments(page);
    }

    await ctx.close();
    return {
      url,
      description: detail.description,
      contactEmail: detail.contactEmail,
      unspscCodes: detail.unspscCodes,
      counties: detail.counties,
      // Prefer the detail-page end date (authoritative) over the listing's.
      endRaw: detail.endRaw || item.endRaw,
      attachments,
    };
  } catch (e) {
    console.warn(`enrich ${eventId} failed: ${e.message}`);
    await ctx.close().catch(() => {});
    return empty;
  }
}

/** Run async tasks over `items` with a fixed concurrency. */
// ===========================================================================
// EXTRACT MODE — download each marketing event's attachment bytes once and
// extract normalized text (pdf-parse / mammoth / xlsx). Output is keyed by
// (eventId, fileName) with a content hash so the caller reprocesses only on
// change. Download links are session-bound, so we fetch bytes in the same
// context that minted them and never persist a URL.
// ===========================================================================

/** Open the event package; return [{ name, buttonId }]. */
async function listEventFiles(page, bu, eventId) {
  await page.goto(`https://caleprocure.ca.gov/event/${bu}/${encodeURIComponent(eventId)}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForSelector('#RESP_INQ_DL0_WK_AUC_DOWNLOAD_PB', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (/error\.aspx/.test(page.url())) return [];
  const pkg = page.locator('#RESP_INQ_DL0_WK_AUC_DOWNLOAD_PB');
  if (!(await pkg.count().catch(() => 0))) return [];
  await pkg.click({ timeout: 12000, force: true }).catch(() => {});
  await page.waitForSelector('[id^="PV_ATTACH_WRK_SCM_DOWNLOAD$"]', { timeout: 12000 }).catch(() => {});
  let last = -1, stable = 0;
  for (let i = 0; i < 30; i++) {
    const n = await page.evaluate(() => [...document.querySelectorAll('[name="ViewAttachmentsFileName"]')].filter((s) => (s.textContent || '').trim()).length).catch(() => 0);
    if (n === last) { stable++; if (stable >= 3 && n > 0) break; } else { stable = 0; last = n; }
    await page.waitForTimeout(500);
  }
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr')].filter((r) => r.querySelector('[name="ViewAttachmentsFileName"]'));
    const out = [];
    for (const r of rows) {
      const f = r.querySelector('[name="ViewAttachmentsFileName"]');
      const name = (f && f.textContent || '').trim();
      if (!name) continue;
      const btn = r.querySelector('[id^="PV_ATTACH_WRK_SCM_DOWNLOAD$"]');
      out.push({ name, buttonId: btn ? btn.id : null });
    }
    return out;
  });
}

/** Reset the "Your file is ready" modal so the next file can be prepared. */
async function resetDownloadModal(page) {
  await page.evaluate(() => {
    const a = document.querySelector('#downloadButton');
    if (a) a.removeAttribute('href');
    try { if (typeof clearAttachmentWrapper === 'function') clearAttachmentWrapper(); } catch {}
    const close = [...document.querySelectorAll('button,a')].find((el) => /^\s*close\s*$/i.test(el.textContent || ''));
    if (close) close.click();
  }).catch(() => {});
  await page.waitForTimeout(800);
}

/** Download one attachment's bytes via its session-bound viewredirect URL. */
async function downloadFileBytes(ctx, page, buttonId) {
  await resetDownloadModal(page);
  await page.locator(`[id="${buttonId.replace(/(["\\$])/g, '\\$1')}"]`).click({ timeout: 10000, force: true }).catch(() => {});
  let href = null;
  for (let i = 0; i < 24; i++) {
    href = await page.evaluate(() => { const a = document.querySelector('#downloadButton'); return a && a.href && a.href.includes('viewredirect') ? a.href : null; }).catch(() => null);
    if (href) break;
    await page.waitForTimeout(500);
  }
  if (!href) return { error: 'no prepared url' };
  const resp = await ctx.request.get(href, { timeout: 45000 }).catch((e) => ({ _err: e.message }));
  if (resp._err) return { error: resp._err };
  const buf = await resp.body().catch(() => Buffer.alloc(0));
  return { buf, contentType: resp.headers()['content-type'] || '' };
}

/** Extract normalized text from file bytes by type. */
async function extractFileText(buf, name, contentType) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const clean = (t) => (t || '').replace(/ /g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  try {
    if (ext === 'pdf' || /pdf/.test(contentType)) {
      const d = await pdfParse(buf);
      const text = clean(d.text);
      // Scanned PDFs yield almost no text — flag for a later OCR pass.
      return text.length > 50 ? { method: 'pdf', text } : { method: 'needs_ocr', text: '' };
    }
    if (ext === 'docx' || /word|officedocument\.wordprocessing/.test(contentType)) {
      const r = await mammoth.extractRawText({ buffer: buf });
      return { method: 'docx', text: clean(r.value) };
    }
    if (ext === 'xlsx' || ext === 'xls' || /sheet|excel/.test(contentType)) {
      const wb = XLSX.read(buf, { type: 'buffer' });
      const parts = wb.SheetNames.map((n) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`);
      return { method: 'xlsx', text: clean(parts.join('\n\n')) };
    }
    return { method: 'unsupported', text: '' };
  } catch (e) {
    return { method: 'error', text: '', error: e.message };
  }
}

/** Extract all attachments for one event into document records. */
async function extractEvent(browser, ev) {
  const eventId = String(ev.eventId || '').trim();
  const bu = ev.bu || buFor(ev.department);
  if (!eventId || !bu) return [];
  const ctx = await browser.newContext({ userAgent: UA, acceptDownloads: true });
  const page = await ctx.newPage();
  const docs = [];
  try {
    const files = await listEventFiles(page, bu, eventId);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const base = { eventId, fileName: f.name, fileIndex: i };
      if (!f.buttonId) { docs.push({ ...base, status: 'error', method: 'error', error: 'no download button', text: '' }); continue; }
      const dl = await downloadFileBytes(ctx, page, f.buttonId);
      if (dl.error) { docs.push({ ...base, status: 'error', method: 'error', error: dl.error, text: '' }); continue; }
      const contentHash = crypto.createHash('sha256').update(dl.buf).digest('hex');
      const ex = await extractFileText(dl.buf, f.name, dl.contentType);
      docs.push({
        ...base,
        mime: dl.contentType || null,
        byteSize: dl.buf.length,
        contentHash,
        method: ex.method,
        text: ex.text || '',
        charCount: (ex.text || '').length,
        status: ex.method === 'error' ? 'error' : (ex.text || '').length > 0 ? 'extracted' : 'empty',
        error: ex.error || null,
      });
    }
  } catch (e) {
    console.warn(`extract ${eventId} failed: ${e.message}`);
  }
  await ctx.close().catch(() => {});
  return docs;
}

async function runExtractMode(events, concurrency) {
  console.log(`Extract mode: ${events.length} events (concurrency ${concurrency})…`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let files = 0, withText = 0, done = 0;
  try {
    await mapPool(events, concurrency, async (ev) => {
      const docs = await extractEvent(browser, ev);
      for (const d of docs) {
        files++;
        if (d.status === 'extracted') withText++;
        await Actor.pushData(d);
      }
      done++;
      if (done % 10 === 0) console.log(`  …${done}/${events.length} events, ${files} files`);
    });
  } finally {
    await browser.close();
  }
  console.log(`Extract done: ${events.length} events, ${files} files, ${withText} with text.`);
  await Actor.exit(`Extract: ${files} files, ${withText} with text.`);
}

// ===========================================================================
// EMBED MODE — local sentence embeddings (all-MiniLM-L6-v2, 384-dim) via
// transformers.js. Runs in this Node container (no external embedding vendor,
// no per-call cost). Input: { mode:'embed', texts:[{id,text}] }; output one
// { id, embedding:number[384] } record per text.
// ===========================================================================

let _embedder = null;
async function getEmbedder() {
  if (!_embedder) {
    const { pipeline } = await import('@huggingface/transformers');
    _embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return _embedder;
}

async function runEmbedMode(texts) {
  console.log(`Embed mode: ${texts.length} texts…`);
  const embed = await getEmbedder();
  let ok = 0;
  for (const t of texts) {
    try {
      const input = String(t.text || '').slice(0, 4000);
      const out = await embed(input, { pooling: 'mean', normalize: true });
      await Actor.pushData({ id: t.id, embedding: Array.from(out.data) });
      ok++;
    } catch (e) {
      console.warn(`embed ${t.id} failed: ${e.message}`);
      await Actor.pushData({ id: t.id, embedding: null, error: e.message });
    }
  }
  console.log(`Embed done: ${ok}/${texts.length} embedded.`);
  await Actor.exit(`Embed: ${ok}/${texts.length} embedded.`);
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

await Actor.init();

const input = (await Actor.getInput()) || {};
const status = input.status || 'P'; // P = Posted (open), H = Historical
const keyword = (input.keyword || '').trim();
const limit = Number.isFinite(input.limit) ? input.limit : 0; // 0 = no cap
const concurrency = Number.isFinite(input.concurrency) && input.concurrency > 0 ? input.concurrency : 5;
const skipEnrich = !!input.skipEnrich;
// Cap how many of the listed events get the (slow) per-event enrichment. 0 = all.
const enrichLimit = Number.isFinite(input.enrichLimit) ? input.enrichLimit : 0;

// EXTRACT MODE: pull attachment text for a given set of events. Input:
//   { mode: 'extract', events: [{ eventId, bu }], concurrency? }
if (input.mode === 'extract') {
  const events = Array.isArray(input.events) ? input.events.filter((e) => e && e.eventId) : [];
  if (events.length === 0) {
    await Actor.exit('Extract: no events provided.');
  } else {
    try {
      await runExtractMode(events, concurrency);
    } catch (err) {
      console.error('Extract failed:', err?.stack || err);
      await Actor.fail(`Extract failed: ${err?.message || err}`);
    }
  }
} else if (input.mode === 'embed') {
  const texts = Array.isArray(input.texts) ? input.texts.filter((t) => t && t.id) : [];
  if (texts.length === 0) {
    await Actor.exit('Embed: no texts provided.');
  } else {
    try {
      await runEmbedMode(texts);
    } catch (err) {
      console.error('Embed failed:', err?.stack || err);
      await Actor.fail(`Embed failed: ${err?.message || err}`);
    }
  }
} else {
  try {
  console.log('Launching Chromium…');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();

  console.log('Loading Cal eProcure event search…');
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);

  await page.selectOption('#RESP_INQA_WK_ZZ_EVENT_STATUS', status).catch(() => {});
  if (keyword) {
    await page.fill('#RESP_INQA_WK_ZZ_AUC_NAME', keyword).catch(() => {});
  }
  await page
    .click('#RESP_INQA_WK_INQ_AUC_GO_PB', { timeout: 20000 })
    .catch((e) => console.warn(`search click: ${e.message}`));
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(7000);

  // Extract the results grid (distinct events).
  let items = await page.evaluate(() => {
    const grid = [...document.querySelectorAll('table')].sort(
      (a, b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length
    )[0];
    if (!grid) return [];
    const out = [];
    for (const r of grid.querySelectorAll('tr')) {
      const cells = [...r.querySelectorAll('td')].map((x) => (x.textContent || '').trim()).filter(Boolean);
      if (cells.length >= 5 && /^[A-Za-z0-9-]+$/.test(cells[0]) && cells[0] !== 'Event ID') {
        out.push({
          eventId: cells[0],
          name: cells[1],
          department: cells[2],
          endRaw: cells[3],
          status: cells[cells.length - 1],
        });
      }
    }
    return [...new Map(out.map((o) => [o.eventId, o])).values()];
  });
  await page.close();

  // Apply keyword/limit to the listing up front so we never enrich rows we'll drop.
  if (keyword) {
    const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    items = items.filter((r) => re.test(r.name));
  }
  if (limit > 0) items = items.slice(0, limit);

  console.log(`Listing extracted: ${items.length} distinct ${status === 'P' ? 'open ' : ''}bids.`);

  // Decide which items get enriched (the rest are emitted listing-only).
  const enrichCount = skipEnrich ? 0 : enrichLimit > 0 ? Math.min(enrichLimit, items.length) : items.length;
  const toEnrich = items.slice(0, enrichCount);
  const listingOnly = items.slice(enrichCount);

  let withAttachments = 0;
  let enriched = 0;

  if (toEnrich.length) {
    console.log(`Enriching ${toEnrich.length} events (concurrency ${concurrency})…`);
    await mapPool(toEnrich, concurrency, async (item) => {
      const ex = await enrichEvent(browser, item);
      const finalResult = {
        ...item,
        name: String(item.name || '').replace(/\s+/g, ' ').replace(/¿/g, '-').trim(),
        endRaw: ex.endRaw || item.endRaw,
        endDate: parseEnd(ex.endRaw || item.endRaw),
        url: ex.url || SEARCH_URL,
        description: ex.description || null,
        contactEmail: ex.contactEmail || null,
        unspscCodes: ex.unspscCodes || [],
        counties: ex.counties || [],
        attachments: ex.attachments || [],
      };
      if (finalResult.attachments.length) withAttachments++;
      enriched++;
      await Actor.pushData(finalResult);
      if (enriched % 25 === 0) console.log(`  …${enriched}/${toEnrich.length} enriched`);
    });
  }

  for (const item of listingOnly) {
    await Actor.pushData({
      ...item,
      name: String(item.name || '').replace(/\s+/g, ' ').replace(/¿/g, '-').trim(),
      endDate: parseEnd(item.endRaw),
      url: SEARCH_URL,
      description: null,
      contactEmail: null,
      unspscCodes: [],
      counties: [],
      attachments: [],
    });
  }

  console.log(
    `Done: ${items.length} bids (${enriched} enriched, ${withAttachments} with attachments, ${listingOnly.length} listing-only).`
  );
  await browser.close();
  await Actor.exit(`Done: ${items.length} bids; ${withAttachments} with attachments.`);
  } catch (err) {
    console.error('Scrape failed:', err?.stack || err);
    await Actor.fail(`Scrape failed: ${err?.message || err}`);
  }
}
