import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
  const page = await ctx.newPage();

  console.log('Loading search...');
  await page.goto('https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Filling search...');
  await page.fill('#RESP_INQA_WK_ZZ_AUC_NAME', 'Translation of Forms, Publications, and Web Content');
  await page.click('#RESP_INQA_WK_INQ_AUC_GO_PB');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const eventIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tr')).map(r => r.cells?.[0]?.textContent?.trim()).filter(x => x && x !== 'Event ID');
  });
  console.log('Event IDs:', eventIds);

  if (eventIds.length > 0) {
    const eid = eventIds[0];
    console.log('Clicking Event:', eid);
    await page.click(`a:has-text("${eid}")`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const pkgBtn = await page.$('input[value="View Event Package"]');
    console.log('Package Button:', !!pkgBtn);
    if (pkgBtn) {
      await pkgBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const html = await page.content();
      console.log('Found RESP_INQ_ATT_VW in HTML?', html.includes('RESP_INQ_ATT_VW'));
      
      const tables = await page.evaluate(() => {
         return Array.from(document.querySelectorAll('table')).map(t => t.id).filter(Boolean);
      });
      console.log('Table IDs:', tables);
    }
  }

  await browser.close();
})();
