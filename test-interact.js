const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8080';
const OUT = path.join(__dirname, 'test-screenshots');

const TOOLS = [
  { file: 'pdf-merge-split.html', name: 'PDF合并拆分', test: async (p) => { /* just loads */ } },
  { file: 'image-compressor.html', name: '图片压缩', test: async (p) => {} },
  { file: 'image-format-converter.html', name: '图片格式转换', test: async (p) => {} },
  { file: 'image-watermark.html', name: '图片水印', test: async (p) => {} },
  { file: 'qr-generator.html', name: '二维码生成', test: async (p) => {
    // Test QR generation
    await p.type('#qrText', 'Hello World');
    await p.click('#generateBtn');
    await p.waitForTimeout(500);
  }},
  { file: 'color-converter.html', name: '颜色转换', test: async (p) => {
    await p.type('#hexInput', 'ff6600');
    await p.waitForTimeout(300);
  }},
  { file: 'json-formatter.html', name: 'JSON工具', test: async (p) => {
    await p.type('#jsonInput', '{"name":"test","value":123}');
    await p.click('#formatBtn');
    await p.waitForTimeout(300);
  }},
  { file: 'text-dedup.html', name: '文本去重', test: async (p) => {
    await p.type('#inputText', 'apple\nbanana\napple\ncherry\nbanana');
    await p.click('#dedupBtn');
    await p.waitForTimeout(300);
  }},
  { file: 'text-diff-tool.html', name: '文本对比', test: async (p) => {
    await p.type('#textA', 'Hello World');
    await p.type('#textB', 'Hello Earth');
    await p.click('#compareBtn');
    await p.waitForTimeout(300);
  }},
  { file: 'word-counter.html', name: '字数统计', test: async (p) => {
    await p.type('#inputText', '这是一段测试文字。This is a test.');
    await p.waitForTimeout(300);
  }},
  { file: 'lorem-generator.html', name: 'Lorem生成器', test: async (p) => {
    await p.click('.btn-primary');
    await p.waitForTimeout(300);
  }},
  { file: 'base64-tool.html', name: 'Base64工具', test: async (p) => {
    await p.type('#textInput', 'Hello World');
    await p.click('#encodeBtn');
    await p.waitForTimeout(300);
  }},
  { file: 'url-encoder.html', name: 'URL编码', test: async (p) => {
    await p.type('#inputText', 'https://example.com?q=你好');
    await p.waitForTimeout(300);
  }},
  { file: 'base-converter.html', name: '进制转换', test: async (p) => {
    await p.type('#decInput', '255');
    await p.waitForTimeout(300);
  }},
  { file: 'hash-generator.html', name: '哈希生成', test: async (p) => {
    await p.type('#textInput', 'Hello World');
    await p.click('#hashBtn');
    await p.waitForTimeout(500);
  }},
  { file: 'regex-tester.html', name: '正则测试', test: async (p) => {
    await p.type('#regexInput', '\\d+');
    await p.type('#testString', 'abc 123 def 456');
    await p.waitForTimeout(500);
  }},
  { file: 'markdown-editor.html', name: 'Markdown编辑', test: async (p) => {
    await p.type('#mdInput', '# Hello\n\n**bold** text\n\n- item 1\n- item 2');
    await p.waitForTimeout(500);
  }},
  { file: 'password-generator.html', name: '密码生成', test: async (p) => {
    await p.click('#generateBtn');
    await p.waitForTimeout(300);
  }},
  { file: 'unit-converter.html', name: '单位换算', test: async (p) => {
    await p.type('#fromValue', '100');
    await p.waitForTimeout(300);
  }},
  { file: 'timestamp-converter.html', name: '时间戳转换', test: async (p) => {
    await p.type('#timestampInput', String(Math.floor(Date.now()/1000)));
    await p.click('#convertBtn');
    await p.waitForTimeout(300);
  }},
];

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const results = [];

  // Test index first
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    try {
      const resp = await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0', timeout: 10000 });
      await page.screenshot({ path: path.join(OUT, 'index.png') });
      const links = await page.$$eval('a.tool-card', els => els.length);
      console.log(`✅ index.html | HTTP ${resp.status()} | ${links} tool cards`);
      results.push({ file: 'index.html', ok: true, links });
    } catch (e) {
      console.log(`❌ index.html | ${e.message.substring(0, 80)}`);
      results.push({ file: 'index.html', ok: false });
    }
    await page.close();
  }

  // Test each tool
  for (const tool of TOOLS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Collect console errors
    const consoleErrors = [];
    const jsErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => jsErrors.push(err.message));

    try {
      const resp = await page.goto(`${BASE}/${tool.file}`, { waitUntil: 'networkidle0', timeout: 15000 });
      const status = resp ? resp.status() : 0;

      // Screenshot initial load
      const ssFile = tool.file.replace('.html', '.png');
      await page.screenshot({ path: path.join(OUT, ssFile) });

      // Run tool-specific test
      let testOk = true;
      let testMsg = '';
      try {
        await tool.test(page);
        // Screenshot after interaction
        await page.screenshot({ path: path.join(OUT, tool.file.replace('.html', '_after.png')) });
      } catch (e) {
        testOk = false;
        testMsg = e.message.substring(0, 100);
      }

      const ok = status === 200 && jsErrors.length === 0 && testOk;
      const mark = ok ? '✅' : '❌';
      let msg = `${mark} ${tool.name} | HTTP ${status} | JS_Errors:${jsErrors.length} | Console_Errors:${consoleErrors.length}`;
      if (!testOk) msg += ` | TEST_FAIL: ${testMsg}`;
      if (jsErrors.length) msg += ` | JS: ${jsErrors[0].substring(0, 80)}`;
      if (consoleErrors.length) msg += ` | Console: ${consoleErrors[0].substring(0, 80)}`;

      console.log(msg);
      results.push({ file: tool.file, name: tool.name, ok, jsErrors, consoleErrors, testOk });

    } catch (e) {
      console.log(`❌ ${tool.name} | LOAD FAIL: ${e.message.substring(0, 80)}`);
      results.push({ file: tool.file, name: tool.name, ok: false });
    }

    await page.close();
  }

  await browser.close();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n=== FINAL: ${passed}/${results.length} PASSED, ${failed} FAILED ===`);

  if (failed > 0) {
    console.log('\nFailed tools:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ${r.name || r.file}: JS=${(r.jsErrors||[]).length} Console=${(r.consoleErrors||[]).length} test=${r.testOk}`);
    });
  }
})();
