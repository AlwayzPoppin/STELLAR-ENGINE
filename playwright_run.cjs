const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let logText = '';
  function log(msg) {
    console.log(msg);
    logText += msg + '\n';
  }

  log('Starting playwright script...');
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
      log(`[BROWSER CONSOLE ${msg.type()}]: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      log(`[BROWSER ERROR]: ${err.toString()}`);
    });

    log('Navigating to page...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    log('Navigation done. Waiting 3 seconds...');
    await page.waitForTimeout(3000);

    // Take screenshot of landing page
    await page.screenshot({ path: 'playwright_landing.png' });
    log('Landing page screenshot saved.');

    // Look for Test Player
    log('Looking for Test Player in hierarchy...');
    const testPlayerItem = page.locator('span:has-text("Test Player")').first();
    const count = await testPlayerItem.count();
    log(`Found ${count} Test Player spans`);
    
    if (count > 0) {
      log('Clicking Test Player span...');
      await testPlayerItem.click();
      await page.waitForTimeout(500);
    } else {
      log('Test Player span not found, trying other selectors...');
      // Let's print the visible text on the page
      const bodyText = await page.evaluate(() => document.body.innerText);
      log(`Page body text snippet: ${bodyText.slice(0, 1000)}`);
    }

    log('Looking for Skeleton Rig button...');
    const rigToolBtn = page.locator('button:has-text("Skeleton"), button:has-text("Rig")').first();
    const rigCount = await rigToolBtn.count();
    log(`Found ${rigCount} Skeleton/Rig buttons`);
    if (rigCount > 0) {
      log('Clicking Skeleton Rig button...');
      await rigToolBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'playwright_after_rig_click.png' });

    await browser.close();
    log('Browser closed.');
  } catch (err) {
    log(`ERROR: ${err.message}\nSTACK: ${err.stack}`);
  } finally {
    fs.writeFileSync('playwright_run_log.txt', logText);
  }
})();
