const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8080';
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });

  // Test 1: Hash Generator with real keyboard input
  console.log('\n=== Hash Generator Test ===');
  const p1 = await b.newPage();
  await p1.goto(BASE + '/hash-generator.html', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1000);
  const ta = await p1.$('textarea');
  await ta.click();
  await ta.type('test', { delay: 50 });
  await delay(2000);
  const hashes = await p1.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.hash-result .hash'));
    return els.map(e => e.textContent.substring(0, 40));
  });
  console.log('Hash values:', JSON.stringify(hashes));
  const md5Expected = '098f6bcd4621d373cade4e832627b4f6';
  if (hashes[0] === md5Expected) {
    console.log('✅ MD5 correct!');
  } else {
    console.log(`❌ MD5 mismatch. Expected: ${md5Expected}, Got: ${hashes[0]}`);
  }
  await p1.close();

  // Test 2: Base Converter - type in DECIMAL input (not binary)
  console.log('\n=== Base Converter Test ===');
  const p2 = await b.newPage();
  await p2.goto(BASE + '/base-converter.html', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1000);
  const decInput = await p2.$('#base10');
  await decInput.click();
  await decInput.type('255', { delay: 30 });
  await delay(500);
  const conversions = await p2.evaluate(() => ({
    bin: document.getElementById('base2').value,
    oct: document.getElementById('base8').value,
    hex: document.getElementById('base16').value,
    b32: document.getElementById('base32').value,
    b36: document.getElementById('base36').value,
    err: document.getElementById('errorMsg').textContent
  }));
  console.log('Conversions:', JSON.stringify(conversions));
  if (conversions.hex === 'FF' && conversions.bin && conversions.oct === '377') {
    console.log('✅ Base conversion correct!');
  } else {
    console.log('❌ Base conversion incorrect');
  }
  await p2.close();

  // Test 3: JSON Formatter
  console.log('\n=== JSON Formatter Test ===');
  const p3 = await b.newPage();
  await p3.goto(BASE + '/json-formatter.html', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1000);
  const jsonTa = await p3.$('textarea');
  await jsonTa.click();
  await jsonTa.type('{"name":"test","value":123}', { delay: 10 });
  await delay(300);
  // Click 美化 button
  const formatBtn = await p3.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent.includes('美化'));
  });
  if (formatBtn && formatBtn.asElement()) {
    await formatBtn.click();
    await delay(500);
  }
  const jsonOutput = await p3.evaluate(() => {
    const tas = Array.from(document.querySelectorAll('textarea'));
    return tas.map(t => t.value.substring(0, 60));
  });
  console.log('JSON textareas:', JSON.stringify(jsonOutput));
  await p3.close();

  // Test 4: Base64 encode
  console.log('\n=== Base64 Encode Test ===');
  const p4 = await b.newPage();
  await p4.goto(BASE + '/base64-tool.html', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1000);
  const b64Ta = await p4.$('textarea');
  await b64Ta.click();
  await b64Ta.type('Hello World!', { delay: 20 });
  await delay(300);
  const encBtn = await p4.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent.includes('Base64 编码'));
  });
  if (encBtn && encBtn.asElement()) {
    await encBtn.click();
    await delay(500);
  }
  const b64Output = await p4.evaluate(() => {
    const tas = Array.from(document.querySelectorAll('textarea'));
    return tas.map(t => t.value.substring(0, 40));
  });
  console.log('Base64 textareas:', JSON.stringify(b64Output));
  await p4.close();

  // Test 5: Text Diff
  console.log('\n=== Text Diff Test ===');
  const p5 = await b.newPage();
  await p5.goto(BASE + '/text-diff-tool.html', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1000);
  const diffTas = await p5.$$('textarea');
  if (diffTas.length >= 2) {
    await diffTas[0].click();
    await diffTas[0].type('Hello\nLine 2\nLine 3\nOnly in A', { delay: 10 });
    await diffTas[1].click();
    await diffTas[1].type('Hello\nLine modified\nLine 3\nOnly in B', { delay: 10 });
    await delay(300);
    const cmpBtn = await p5.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('执行对比'));
    });
    if (cmpBtn && cmpBtn.asElement()) {
      await cmpBtn.click();
      await delay(500);
    }
    const diffResult = await p5.evaluate(() => {
      const el = document.querySelector('[class*="diff"], [id*="diff"], .diff-output');
      const body = document.body.innerText;
      return {
        hasDiffEl: !!el,
        hasModified: body.includes('modified') || body.includes('changed'),
        hasAdded: body.includes('Only in B'),
        hasRemoved: body.includes('Only in A'),
        snippet: body.substring(body.length - 300)
      };
    });
    console.log('Diff result:', JSON.stringify(diffResult, null, 2));
  }
  await p5.close();

  // Test 6: PDF merge/split - find 404 resource
  console.log('\n=== PDF Tool 404 Check ===');
  const p6 = await b.newPage();
  const failedResources = [];
  p6.on('response', resp => { if (resp.status() === 404) failedResources.push(resp.url()); });
  p6.on('console', msg => { if (msg.type() === 'error') console.log('  Console err:', msg.text().substring(0, 80)); });
  await p6.goto(BASE + '/pdf-merge-split.html', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(2000);
  console.log('Failed resources:', failedResources);
  await p6.close();

  await b.close();
  console.log('\n=== All focused tests complete ===');
})();
