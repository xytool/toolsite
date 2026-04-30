const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });

  // JSON Formatter - test output via div
  console.log('=== JSON Formatter ===');
  const p1 = await b.newPage();
  await p1.goto('http://127.0.0.1:8080/json-formatter.html', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1000);
  await p1.evaluate(() => document.getElementById('inputJSON').value = '');
  const ta = await p1.$('#inputJSON');
  await ta.click();
  await ta.type('{"name":"test","value":123,"nested":{"a":1}}', { delay: 10 });
  await delay(200);
  // Click beautify
  const btn = await p1.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent.includes('美化') && b.textContent.includes('✨'));
  });
  if (btn && btn.asElement()) {
    await btn.click();
    await delay(500);
  }
  const output = await p1.evaluate(() => ({
    outputArea: document.getElementById('outputArea')?.innerHTML?.substring(0, 200),
    outputInfo: document.getElementById('outputInfo')?.textContent,
    outputError: document.getElementById('outputError')?.textContent
  }));
  console.log('Output HTML:', output.outputArea);
  console.log('Output Info:', output.outputInfo);
  console.log('Output Error:', output.outputError);
  await p1.close();

  // Now do a comprehensive visual test of ALL tools with screenshots
  console.log('\n=== Taking final screenshots ===');
  const tools = [
    'pdf-merge-split.html', 'image-compressor.html', 'image-format-converter.html',
    'image-watermark.html', 'qr-generator.html', 'color-converter.html',
    'json-formatter.html', 'text-dedup.html', 'text-diff-tool.html',
    'word-counter.html', 'lorem-generator.html', 'base64-tool.html',
    'url-encoder.html', 'base-converter.html', 'hash-generator.html',
    'regex-tester.html', 'markdown-editor.html', 'password-generator.html',
    'unit-converter.html', 'timestamp-converter.html'
  ];

  for (const file of tools) {
    const page = await b.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    
    try {
      await page.goto(`http://127.0.0.1:8080/${file}`, { waitUntil: 'networkidle0', timeout: 15000 });
      await delay(1500);
      
      const title = await page.evaluate(() => document.querySelector('h1')?.textContent || '');
      const status = errs.length === 0 ? '✅' : '⚠️';
      console.log(`${status} ${title || file}`);
      if (errs.length) console.log(`   JS: ${errs[0].substring(0, 80)}`);
    } catch (e) {
      console.log(`❌ ${file}: ${e.message.substring(0, 60)}`);
    }
    await page.close();
  }

  await b.close();
  console.log('\nDone!');
})();
