const fs = require('fs');

const path = 'apify/caleprocure-listings/src/main.ts';
let code = fs.readFileSync(path, 'utf8');

const newAttachmentLogic = `
      // Capture the exact real deep link URL while on the details page
      itemUrl = page.url();

      // Check for "View Event Package" or "View Bid Comments" / "View Event Comments"
      let btnToClick = await page.$('input[value="View Event Package"]');
      if (!btnToClick) {
        btnToClick = await page.$('input[value="View Bid Comments"]');
      }
      if (!btnToClick) {
        btnToClick = await page.$('input[value="View Event Comments"]');
      }
      if (!btnToClick) {
        btnToClick = await page.$('input[value="Bid Comments"]');
      }

      if (btnToClick) {
        await btnToClick.click();
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(3000);

        // Extract the attachments table
        attachments = await page.evaluate(() => {
          // It could be RESP_INQ_ATT_VW$scroll or similar
          const table = document.querySelector('table[id^="RESP_INQ_ATT_VW$scroll"]') || document.querySelector('table');
          if (!table) return [];
          
          const rows = Array.from(table.querySelectorAll('tr')).slice(1); // skip header
          return rows.map(r => {
            const cells = r.querySelectorAll('td');
            if (cells.length < 3) return null;
            const link = cells[1].querySelector('a');
            return {
              name: (link?.textContent || cells[1].textContent || '').trim(),
              description: (cells[2] ? cells[2].textContent : '').trim(),
              url: link?.href || '',
            };
          }).filter(Boolean);
        });

        console.log(\`Found \${attachments.length} attachments for \${item.eventId}\`);

        // Click "Return to Event Search" or "Return" to go back to the details page
        const returnBtn1 = await page.$('input[value="Return to Event Search"]') || await page.$('input[value="Return"]');
        if (returnBtn1) {
          await returnBtn1.click();
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(3000);
        }
      }
`;

code = code.replace(/\/\/ Capture the exact real deep link URL while on the details page[\s\S]*?if \(returnBtn1\) \{[\s\S]*?\}[\s\S]*?\}/, newAttachmentLogic);

fs.writeFileSync(path, code);
