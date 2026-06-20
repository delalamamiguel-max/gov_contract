// Cal eProcure — Open Bids (listings) scraper.
//
// Drives the InFlight/PeopleSoft SPA at caleprocure.ca.gov: runs the public
// "Posted" (open) event search and extracts every distinct bid from the results
// grid — the thing off-the-shelf actors fail to do (they mishandle the
// PeopleSoft session and return one repeated row).
//
// Output item: { eventId, name, department, endRaw, endDate, status, url }

import { Actor } from 'apify';
import { chromium } from 'playwright';

const SEARCH_URL = 'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

/** Parse "06/08/2026 8:00AM PDT" style strings into ISO. */
function parseEnd(raw) {
  if (!raw) return null;
  // Insert a space between date and time if glued: 06/08/20268:00AM
  const m = String(raw).match(/(\d{2}\/\d{2}\/\d{4})\s*(.*)$/);
  if (!m) return null;
  const [, date, time] = m;
  const d = new Date(`${date} ${time}`.replace(/\s+/g, ' ').trim());
  if (!isNaN(d.getTime())) return d.toISOString();
  const d2 = new Date(date);
  return isNaN(d2.getTime()) ? null : d2.toISOString();
}

await Actor.init();

const input = (await Actor.getInput()) || {};
const status = input.status || 'P'; // P = Posted (open), H = Historical
const keyword = (input.keyword || '').trim();
const limit = Number.isFinite(input.limit) ? input.limit : 0; // 0 = no cap

try {
  console.log('Launching Chromium…');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();

  console.log('Loading Cal eProcure event search…');
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Set status (Posted) and run the search.
  await page.selectOption('#RESP_INQA_WK_ZZ_EVENT_STATUS', status).catch(() => {});
  if (keyword) {
    await page.fill('#RESP_INQA_WK_ZZ_AUC_NAME', keyword).catch(() => {});
  }
  await page.click('#RESP_INQA_WK_INQ_AUC_GO_PB', { timeout: 20000 }).catch((e) => console.warn(`search click: ${e.message}`));
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(7000);

  // Extract the results grid.
  const items = await page.evaluate(() => {
    const grid = [...document.querySelectorAll('table')]
      .sort((a, b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length)[0];
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

  // Loop over each extracted event to fetch its attachments if necessary
  const finalResults = [];
  
  for (const item of items) {
    let attachments = [];
    let itemUrl = 'https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx';
    try {
      console.log(`Processing event: ${item.eventId} - ${item.name}`);
      
      // Always scrape attachments and capture the deep link for every item
      // Click the Event ID link to go to event details
      await page.click(`a:has-text("${item.eventId}")`, { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);
      
      // Capture the exact real deep link URL while on the details page
      itemUrl = page.url();

      // Click "View Event Package" or "View Bid Comments" / "View Event Comments"
      let btnToClick = await page.$('input[value="View Event Package"]');
      if (!btnToClick) {
        btnToClick = await page.$('input[value="View Bid Comments"]');
      }
      if (!btnToClick) {
        btnToClick = await page.$('input[value="View Event Comments"]');
      }

      if (btnToClick) {
        await btnToClick.click();
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(3000);

        // Extract the attachments table
        attachments = await page.evaluate(() => {
          const table = document.querySelector('table[id^="RESP_INQ_ATT_VW$scroll"]') || document.querySelector('table[id^="AUC_ATT_VW$scroll"]') || document.querySelector('table[id*="ATT_VW"]');
          if (!table) return [];
          
          const rows = Array.from(table.querySelectorAll('tr')).slice(1); // skip header
          return rows.map(r => {
            const cells = r.querySelectorAll('td');
            if (cells.length < 2) return null; // Relaxed from 3 to 2 because sometimes there is no description column
            const link = cells[1]?.querySelector('a') || cells[0]?.querySelector('a');
            if (!link) return null;
            return {
              name: link.textContent.trim(),
              description: cells.length >= 3 ? (cells[2].textContent || '').trim() : '',
              url: link.href || '',
            };
          }).filter(Boolean);
        });

        console.log(`Found ${attachments.length} attachments for ${item.eventId}`);

        // Click "Return to Event Search" or "Return" to go back to the details page
        const returnBtn1 = await page.$('input[value="Return to Event Search"]') || await page.$('input[value="Return"]');
        if (returnBtn1) {
          await returnBtn1.click();
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(3000);
        }
      }
      
      // Click "Return to Event Search" again to go back to the grid
      const returnBtn2 = await page.$('input[value="Return to Event Search"]');
      if (returnBtn2) {
        await returnBtn2.click();
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      console.warn(`Failed to process attachments for ${item.eventId}: ${e.message}`);
    }

    const finalResult = {
      ...item,
      name: item.name.replace(/\s+/g, ' ').replace(/¿/g, '-').trim(),
      endDate: parseEnd(item.endRaw),
      url: itemUrl,
      attachments,
    };
    finalResults.push(finalResult);
    await Actor.pushData(finalResult);
    
    if (limit > 0 && finalResults.length >= limit) break;
  }

  let results = finalResults;

  // Keyword and limit filtering is now already handled in the loop above
  // but we leave this here as an extra safety measure just in case.
  if (keyword) {
    const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    results = results.filter((r) => re.test(r.name));
  }
  if (limit > 0) results = results.slice(0, limit);

  console.log(`Extracted ${results.length} distinct ${status === 'P' ? 'open' : ''} bids.`);
  await browser.close();
  await Actor.exit(`Done: ${results.length} bids.`);
} catch (err) {
  console.error('Scrape failed:', err?.stack || err);
  await Actor.fail(`Scrape failed: ${err?.message || err}`);
}
