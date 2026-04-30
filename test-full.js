const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8080';
const OUT = path.join(__dirname, 'test-screenshots');

const tools = [
  'pdf-merge-split.html',
  'image-compressor.html',
  'image-format-converter.html',
  'image-watermark.html',
  'qr-generator.html',
  'color-converter.html',
  'json-formatter.html',
  'text-dedup.html',
  'text-diff-tool.html',
  'word-counter.html',
  'lorem-generator.html',
  'base64-tool.html',
  'url-encoder.html',
  'base-converter.html',
  'hash-generator.html',
  'regex-tester.html',
  'markdown-editor.html',
  'password-generator.html',
  'unit-converter.html',
  'timestamp-converter.html',
];

const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Test index
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const resp = await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.screenshot({ path: path.join(OUT, 'index.png') });
    const cards = await page.$$eval('a.tool-card', els => els.length);
    const brokenLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.tool-card'));
      return links.map(a => a.href).filter(h => !h);
    });
    console.log(`📄 index.html | HTTP ${resp.status()} | ${cards} cards`);
    await page.close();
  }

  for (const file of tools) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const jsErrors = [];
    const consoleErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      const resp = await page.goto(`${BASE}/${file}`, { waitUntil: 'networkidle0', timeout: 20000 });
      const status = resp ? resp.status() : 0;
      await delay(1500); // Wait for any lazy init

      // Screenshot
      await page.screenshot({ path: path.join(OUT, file.replace('.html', '.png')) });

      // Get page info
      const info = await page.evaluate(() => {
        const title = document.title;
        const h1 = document.querySelector('h1')?.textContent || '';
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0, 5);
        const inputs = Array.from(document.querySelectorAll('input[type="text"],input[type="number"],textarea,select')).map(e => ({
          tag: e.tagName,
          id: e.id,
          type: e.type,
          placeholder: e.placeholder?.substring(0, 30) || ''
        })).slice(0, 8);
        const hasContent = document.body.innerText.length > 100;
        return { title, h1, buttons, inputs, hasContent };
      });

      const mark = jsErrors.length === 0 && info.hasContent ? '✅' : '❌';
      const name = info.h1 || file;
      console.log(`${mark} ${file} | HTTP ${status} | JS:${jsErrors.length} Console:${consoleErrors.length} | ${info.title}`);
      
      if (jsErrors.length) {
        console.log(`   ⚠️ JS Errors: ${jsErrors.map(e => e.substring(0, 80)).join(' | ')}`);
      }
      if (consoleErrors.length) {
        console.log(`   ⚠️ Console: ${consoleErrors.map(e => e.substring(0, 80)).join(' | ')}`);
      }
      console.log(`   📋 H1: ${info.h1} | Buttons: ${info.buttons.join(', ').substring(0, 60)}`);
      console.log(`   📝 Inputs: ${info.inputs.map(i => i.id || i.placeholder || i.tag).join(', ').substring(0, 80)}`);

    } catch (e) {
      console.log(`❌ ${file} | LOAD ERROR: ${e.message.substring(0, 100)}`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\n=== Test Complete ===');
  console.log(`Screenshots saved to: ${OUT}`);
})();
