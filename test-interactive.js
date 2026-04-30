const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8080';
const OUT = path.join(__dirname, 'screenshots');
const delay = ms => new Promise(r => setTimeout(r, ms));

const tools = [
  {
    file: 'pdf-merge-split.html',
    name: 'PDF合并拆分',
    test: async (page) => {
      // Test merge tab - upload is complex, just check UI renders
      const tabs = await page.$$('.tab-btn');
      console.log(`     Tabs found: ${tabs.length}`);
      // Click split tab
      if (tabs.length > 1) await tabs[1].click();
      await delay(500);
      const splitUI = await page.evaluate(() => !!document.querySelector('#split-panel, .split-panel, [id*="split"]'));
      console.log(`     Split panel visible: ${splitUI}`);
    }
  },
  {
    file: 'image-compressor.html',
    name: '图片压缩',
    test: async (page) => {
      // Check upload area exists
      const uploadArea = await page.$('.upload-area, .drop-zone, [class*="upload"], [class*="drop"]');
      console.log(`     Upload area found: ${!!uploadArea}`);
      // Check quality slider
      const slider = await page.$('input[type="range"]');
      console.log(`     Quality slider found: ${!!slider}`);
      if (slider) {
        await page.evaluate(() => { const s = document.querySelector('input[type="range"]'); if(s) s.value = 50; });
      }
    }
  },
  {
    file: 'image-format-converter.html',
    name: '图片格式转换',
    test: async (page) => {
      const uploadArea = await page.$('.upload-area, .drop-zone, [class*="upload"]');
      console.log(`     Upload area found: ${!!uploadArea}`);
      const formatSelect = await page.$('select');
      console.log(`     Format select found: ${!!formatSelect}`);
    }
  },
  {
    file: 'image-watermark.html',
    name: '图片水印',
    test: async (page) => {
      const uploadArea = await page.$('.upload-area, .drop-zone, [class*="upload"]');
      console.log(`     Upload area found: ${!!uploadArea}`);
      // Check watermark text input
      const textInput = await page.$('input[type="text"]');
      console.log(`     Text input found: ${!!textInput}`);
      if (textInput) {
        await textInput.type('TEST水印', { delay: 20 });
        await delay(300);
        const val = await page.evaluate(() => document.querySelector('input[type="text"]')?.value);
        console.log(`     Watermark text: ${val}`);
      }
    }
  },
  {
    file: 'qr-generator.html',
    name: '二维码生成',
    test: async (page) => {
      // Type in QR content input
      const textarea = await page.$('textarea, input[type="text"]');
      console.log(`     Input found: ${!!textarea}`);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('https://example.com', { delay: 20 });
        await delay(1500); // Wait for QR render
        const canvas = await page.$('canvas');
        console.log(`     QR Canvas rendered: ${!!canvas}`);
      }
    }
  },
  {
    file: 'color-converter.html',
    name: '颜色转换',
    test: async (page) => {
      // Input a hex color
      const hexInput = await page.$('input[type="color"], input[id*="hex"], input[class*="hex"]');
      console.log(`     Color input found: ${!!hexInput}`);
      // Try clicking a preset color if available
      const presets = await page.$$('.color-preset, .preset, [class*="preset"]');
      console.log(`     Preset colors found: ${presets.length}`);
      if (presets.length > 0) {
        await presets[0].click();
        await delay(300);
      }
      // Check output values exist
      const rgbVal = await page.evaluate(() => {
        const el = document.querySelector('[id*="rgb"], [class*="rgb"]');
        return el ? el.textContent.substring(0, 30) : 'not found';
      });
      console.log(`     RGB output: ${rgbVal}`);
    }
  },
  {
    file: 'json-formatter.html',
    name: 'JSON格式化',
    test: async (page) => {
      const textarea = await page.$('textarea');
      console.log(`     Textarea found: ${!!textarea}`);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('{"name":"test","value":123,"nested":{"a":1}}', { delay: 10 });
        await delay(200);
        // Click format button
        const formatBtn = await page.$('button');
        if (formatBtn) {
          const btnText = await page.evaluate(b => b.textContent.trim(), formatBtn);
          console.log(`     First button: ${btnText}`);
          await formatBtn.click();
          await delay(500);
          const output = await page.evaluate(() => {
            const el = document.querySelector('.output, [id*="output"], [id*="result"], pre, code');
            return el ? el.textContent.substring(0, 50) : 'no output element';
          });
          console.log(`     Output preview: ${output}`);
        }
      }
    }
  },
  {
    file: 'text-dedup.html',
    name: '文本去重排序',
    test: async (page) => {
      const textarea = await page.$('textarea');
      console.log(`     Textarea found: ${!!textarea}`);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('apple\nbanana\napple\ncherry\nbanana', { delay: 10 });
        await delay(200);
        const dedupBtn = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.find(b => b.textContent.includes('去重') || b.textContent.includes('dedup') || b.textContent.includes('Dedup'));
        });
        if (dedupBtn && dedupBtn.asElement()) {
          await dedupBtn.click();
          await delay(500);
          const output = await page.evaluate(() => {
            const el = document.querySelectorAll('textarea')[1] || document.querySelector('.output, [id*="output"], [id*="result"]');
            return el ? el.value?.substring(0, 50) || el.textContent.substring(0, 50) : 'no output';
          });
          console.log(`     Output: ${output}`);
        } else {
          console.log(`     Dedup button not found, trying all buttons`);
          const btns = await page.$$('button');
          console.log(`     Buttons available: ${btns.length}`);
          for (const btn of btns) {
            const t = await page.evaluate(b => b.textContent.trim(), btn);
            console.log(`       - ${t}`);
          }
        }
      }
    }
  },
  {
    file: 'text-diff-tool.html',
    name: '文本对比',
    test: async (page) => {
      const textareas = await page.$$('textarea');
      console.log(`     Textareas found: ${textareas.length}`);
      if (textareas.length >= 2) {
        await textareas[0].click({ clickCount: 3 });
        await textareas[0].type('Hello World\nLine 2\nLine 3', { delay: 10 });
        await textareas[1].click({ clickCount: 3 });
        await textareas[1].type('Hello World\nLine modified\nLine 3', { delay: 10 });
        await delay(200);
        const compareBtn = await page.$('button');
        if (compareBtn) {
          await compareBtn.click();
          await delay(500);
          const hasDiff = await page.evaluate(() => document.body.innerText.includes('modified') || document.body.innerText.includes('diff') || document.body.innerText.includes('不同'));
          console.log(`     Diff result shown: ${hasDiff}`);
        }
      }
    }
  },
  {
    file: 'word-counter.html',
    name: '字数统计',
    test: async (page) => {
      const textarea = await page.$('textarea');
      console.log(`     Textarea found: ${!!textarea}`);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('This is a test sentence. 这是一个测试句子。Count the words here.', { delay: 10 });
        await delay(800);
        const stats = await page.evaluate(() => {
          const text = document.body.innerText;
          const charMatch = text.match(/(\d+)\s*(字|char)/i);
          const wordMatch = text.match(/(\d+)\s*(词|word)/i);
          return { charCount: charMatch ? charMatch[1] : 'N/A', wordCount: wordMatch ? wordMatch[1] : 'N/A' };
        });
        console.log(`     Chars: ${stats.charCount}, Words: ${stats.wordCount}`);
      }
    }
  },
  {
    file: 'lorem-generator.html',
    name: 'Lorem生成器',
    test: async (page) => {
      // Find and click generate button
      const genBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('生成') || b.textContent.includes('Generate') || b.textContent.includes('gen'));
      });
      if (genBtn && genBtn.asElement()) {
        await genBtn.click();
        await delay(500);
        const output = await page.evaluate(() => {
          const ta = document.querySelectorAll('textarea')[0];
          return ta ? ta.value.substring(0, 60) : 'no textarea';
        });
        console.log(`     Generated: ${output}`);
      } else {
        const btns = await page.$$('button');
        console.log(`     Buttons: ${btns.length}`);
        for (const b of btns) {
          const t = await page.evaluate(el => el.textContent.trim(), b);
          console.log(`       - ${t}`);
        }
      }
    }
  },
  {
    file: 'base64-tool.html',
    name: 'Base64工具',
    test: async (page) => {
      const textarea = await page.$('textarea');
      console.log(`     Textarea found: ${!!textarea}`);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('Hello World!', { delay: 10 });
        await delay(200);
        const encodeBtn = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.find(b => b.textContent.includes('编码') || b.textContent.includes('Encode') || b.textContent.includes('encode'));
        });
        if (encodeBtn && encodeBtn.asElement()) {
          await encodeBtn.click();
          await delay(500);
          const output = await page.evaluate(() => {
            const el = document.querySelectorAll('textarea')[1] || document.querySelector('.output, [id*="output"], [id*="result"]');
            return el ? (el.value || el.textContent).substring(0, 40) : 'no output';
          });
          console.log(`     Encoded: ${output}`);
        }
      }
    }
  },
  {
    file: 'url-encoder.html',
    name: 'URL编解码',
    test: async (page) => {
      const textarea = await page.$('textarea');
      console.log(`     Textarea found: ${!!textarea}`);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('https://example.com?q=你好世界&lang=中文', { delay: 10 });
        await delay(200);
        const encodeBtn = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.find(b => b.textContent.includes('编码') || b.textContent.includes('Encode') || b.textContent.includes('encode'));
        });
        if (encodeBtn && encodeBtn.asElement()) {
          await encodeBtn.click();
          await delay(500);
          const output = await page.evaluate(() => {
            const el = document.querySelectorAll('textarea')[1] || document.querySelector('.output, [id*="output"]');
            return el ? (el.value || el.textContent).substring(0, 60) : 'no output';
          });
          console.log(`     Encoded: ${output}`);
        }
      }
    }
  },
  {
    file: 'base-converter.html',
    name: '进制转换',
    test: async (page) => {
      const input = await page.$('input[type="number"], input[type="text"]');
      console.log(`     Input found: ${!!input}`);
      if (input) {
        await input.click({ clickCount: 3 });
        await input.type('255', { delay: 20 });
        await delay(500);
        const results = await page.evaluate(() => {
          const text = document.body.innerText;
          const hex = text.match(/1[6]进[制制].*?([0-9A-Fa-f]+)/);
          const bin = text.match(/2进[制制].*?([01]+)/);
          return { hex: hex ? hex[1] : 'N/A', bin: bin ? bin[1].substring(0, 10) : 'N/A' };
        });
        console.log(`     255 → Hex: ${results.hex}, Bin: ${results.bin}`);
      }
    }
  },
  {
    file: 'hash-generator.html',
    name: '哈希生成',
    test: async (page) => {
      const textarea = await page.$('textarea, input[type="text"]');
      console.log(`     Input found: ${!!textarea}`);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('test hash input', { delay: 10 });
        await delay(800);
        const md5 = await page.evaluate(() => {
          const el = document.querySelector('[id*="md5"], [class*="md5"]');
          if (el) return el.value || el.textContent;
          const text = document.body.innerText;
          const m = text.match(/MD5[\s:]*([a-f0-9]{32})/i);
          return m ? m[1] : 'not found';
        });
        console.log(`     MD5: ${md5}`);
      }
    }
  },
  {
    file: 'regex-tester.html',
    name: '正则测试器',
    test: async (page) => {
      const regexInput = await page.$$('input[type="text"]');
      console.log(`     Inputs found: ${regexInput.length}`);
      if (regexInput.length > 0) {
        await regexInput[0].click({ clickCount: 3 });
        await regexInput[0].type('\\d+', { delay: 20 });
      }
      const textarea = await page.$('textarea');
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('Hello 123 World 456', { delay: 10 });
        await delay(800);
        const matches = await page.evaluate(() => {
          const text = document.body.innerText;
          return text.includes('123') || text.includes('456') || text.includes('match');
        });
        console.log(`     Matches highlighted: ${matches}`);
      }
    }
  },
  {
    file: 'markdown-editor.html',
    name: 'Markdown编辑器',
    test: async (page) => {
      const textarea = await page.$('textarea');
      console.log(`     Textarea found: ${!!textarea}`);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await textarea.type('# Hello\n\n**Bold text** and *italic*\n\n- List item 1\n- List item 2', { delay: 10 });
        await delay(1000);
        const preview = await page.evaluate(() => {
          const el = document.querySelector('.preview, [id*="preview"], [class*="preview"], iframe');
          if (el) return el.innerHTML.substring(0, 100);
          const h1 = document.querySelector('h1');
          return h1 ? h1.textContent : 'no preview';
        });
        console.log(`     Preview: ${preview.substring(0, 60)}`);
      }
    }
  },
  {
    file: 'password-generator.html',
    name: '密码生成器',
    test: async (page) => {
      const genBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('生成') || b.textContent.includes('Generate') || b.textContent.includes('gen'));
      });
      if (genBtn && genBtn.asElement()) {
        await genBtn.click();
        await delay(500);
        const pwd = await page.evaluate(() => {
          const el = document.querySelector('input[type="text"], [id*="password"], [class*="password"], [id*="result"]');
          return el ? (el.value || el.textContent).substring(0, 30) : 'not found';
        });
        console.log(`     Generated password: ${pwd}`);
      }
    }
  },
  {
    file: 'unit-converter.html',
    name: '单位换算',
    test: async (page) => {
      // Click first category
      const cats = await page.$$('.category-item, .cat-item, [class*="category"]');
      console.log(`     Categories found: ${cats.length}`);
      if (cats.length > 0) {
        await cats[0].click();
        await delay(300);
      }
      const input = await page.$('input[type="number"], input[type="text"]');
      console.log(`     Input found: ${!!input}`);
      if (input) {
        await input.click({ clickCount: 3 });
        await input.type('100', { delay: 20 });
        await delay(500);
        const result = await page.evaluate(() => {
          const el = document.querySelectorAll('input[type="number"], input[type="text"], [class*="result"]');
          const vals = Array.from(el).map(e => e.value || e.textContent).filter(v => v && v !== '100');
          return vals.length > 0 ? vals[0].substring(0, 20) : 'no result';
        });
        console.log(`     100 → ${result}`);
      }
    }
  },
  {
    file: 'timestamp-converter.html',
    name: '时间戳转换',
    test: async (page) => {
      // Click current timestamp button if available
      const nowBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('当前') || b.textContent.includes('Now') || b.textContent.includes('now') || b.textContent.includes('获取'));
      });
      if (nowBtn && nowBtn.asElement()) {
        await nowBtn.click();
        await delay(500);
        const result = await page.evaluate(() => {
          const el = document.querySelector('[id*="result"], [id*="date"], [id*="time"], input');
          return el ? (el.value || el.textContent).substring(0, 40) : 'no output';
        });
        console.log(`     Current timestamp result: ${result}`);
      } else {
        const btns = await page.$$('button');
        console.log(`     Buttons available: ${btns.length}`);
      }
    }
  },
];

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  let passed = 0, failed = 0, issues = [];

  for (const tool of tools) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const jsErrors = [];
    const consoleErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      const resp = await page.goto(`${BASE}/${tool.file}`, { waitUntil: 'networkidle0', timeout: 20000 });
      const status = resp ? resp.status() : 0;
      await delay(1500);

      // Take screenshot
      await page.screenshot({ path: path.join(OUT, tool.file.replace('.html', '.png')), fullPage: false });

      // Check basic render
      const hasContent = await page.evaluate(() => document.body.innerText.length > 50);
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔧 ${tool.name} (${tool.file})`);
      console.log(`   HTTP: ${status} | Content: ${hasContent ? 'OK' : 'EMPTY'} | JS Errors: ${jsErrors.length} | Console Errors: ${consoleErrors.length}`);

      if (jsErrors.length) {
        console.log(`   ⚠️ JS ERRORS:`);
        jsErrors.forEach(e => console.log(`     - ${e.substring(0, 120)}`));
        issues.push(`${tool.name}: JS error - ${jsErrors[0].substring(0, 80)}`);
      }
      if (consoleErrors.length) {
        console.log(`   ⚠️ CONSOLE ERRORS:`);
        consoleErrors.forEach(e => console.log(`     - ${e.substring(0, 120)}`));
        if (!jsErrors.length) issues.push(`${tool.name}: Console error - ${consoleErrors[0].substring(0, 80)}`);
      }

      // Run specific test
      if (hasContent) {
        try {
          await tool.test(page);
        } catch (e) {
          console.log(`   ❌ Test error: ${e.message.substring(0, 100)}`);
          issues.push(`${tool.name}: Test failed - ${e.message.substring(0, 80)}`);
        }
      }

      if (!jsErrors.length && hasContent) {
        passed++;
        console.log(`   ✅ PASSED`);
      } else {
        failed++;
        console.log(`   ❌ FAILED`);
      }

    } catch (e) {
      console.log(`\n❌ ${tool.name} (${tool.file}) - LOAD FAILED: ${e.message.substring(0, 100)}`);
      failed++;
      issues.push(`${tool.name}: Load failed`);
    }

    await page.close();
  }

  // Test index page
  const idxPage = await browser.newPage();
  await idxPage.setViewport({ width: 1280, height: 900 });
  try {
    await idxPage.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0', timeout: 15000 });
    await delay(1000);
    await idxPage.screenshot({ path: path.join(OUT, 'index.png') });
    const cardCount = await idxPage.evaluate(() => document.querySelectorAll('a.tool-card, .tool-card, .card').length);
    console.log(`\n📄 Index page: ${cardCount} tool cards`);
    
    // Click first tool card to test navigation
    const firstCard = await idxPage.$('a.tool-card, .tool-card a, .card a');
    if (firstCard) {
      await firstCard.click();
      await delay(2000);
      const toolTitle = await idxPage.evaluate(() => document.title);
      console.log(`   Navigation works → ${toolTitle}`);
    }
  } catch (e) {
    console.log(`\n❌ Index page error: ${e.message.substring(0, 80)}`);
  }
  await idxPage.close();

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SUMMARY: ${passed} passed, ${failed} failed out of ${tools.length}`);
  if (issues.length) {
    console.log(`\n🔍 Issues found:`);
    issues.forEach(i => console.log(`   - ${i}`));
  }
  console.log(`\n📸 Screenshots: ${OUT}`);
})();
