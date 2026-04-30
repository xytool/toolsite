const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8080';
const OUT_DIR = path.join(__dirname, 'test-screenshots');

const TOOLS = [
  'index.html',
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

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = [];
  
  for (const tool of TOOLS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
      const url = `${BASE}/${tool}`;
      const resp = await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
      
      const status = resp ? resp.status() : 'no response';
      const screenshotFile = tool.replace('.html', '.png');
      await page.screenshot({ path: path.join(OUT_DIR, screenshotFile), fullPage: false });
      
      // Check for JS errors
      const jsErrors = [];
      page.on('pageerror', err => jsErrors.push(err.message));
      
      // Check for console errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      
      // Wait a bit for any lazy-loaded stuff
      await new Promise(r => setTimeout(r, 1000));
      
      // Check if page has meaningful content
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
      const hasContent = bodyText.length > 50;
      
      results.push({
        tool,
        status,
        title,
        hasContent,
        jsErrors: jsErrors.length,
        consoleErrors: consoleErrors.length,
        ok: status === 200 && hasContent
      });
      
      console.log(`${okMark(results[results.length-1])} ${tool} | HTTP ${status} | Title: "${title}" | Content: ${bodyText.length} chars`);
    } catch (err) {
      results.push({ tool, status: 'ERROR', error: err.message, ok: false });
      console.log(`❌ ${tool} | ERROR: ${err.message.substring(0, 100)}`);
    }
    
    await page.close();
  }
  
  await browser.close();
  
  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`Passed: ${passed}/${results.length} | Failed: ${failed}`);
  
  results.filter(r => !r.ok).forEach(r => {
    console.log(`  FAIL: ${r.tool} - ${r.error || `HTTP ${r.status}`}`);
  });
})();

function okMark(r) { return r.ok ? '✅' : '❌'; }
