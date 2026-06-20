import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
  const page = await ctx.newPage();

  console.log('Loading search...');
  await page.goto('https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Filling search...');
  await page.fill('#RESP_INQA_WK_ZZ_AUC_NAME', 'Translation');
  await page.click('#RESP_INQA_WK_INQ_AUC_GO_PB');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const events = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tr')).map(r => ({
      id: r.cells?.[0]?.textContent?.trim(),
      name: r.cells?.[1]?.textContent?.trim()
    })).filter(x => x.id && x.id !== 'Event ID');
  });
  console.log('Events:', events);

  const target = events.find(e => e.name.includes('Translation of Forms'));
  if (target) {
    console.log('Clicking Event:', target.id);
    await page.click(`a:has-text("${target.id}")`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input[type="button"]')).map(b => b.value);
    });
    console.log('Available Buttons:', buttons);
  }

  await browser.close();
})();
