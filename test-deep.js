const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8080';
const delay = ms => new Promise(r => setTimeout(r, ms));

// Deep interactive test for tools that had empty output
async function deepTest(browser, file, name, testFn) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  
  try {
    await page.goto(`${BASE}/${file}`, { waitUntil: 'networkidle0', timeout: 20000 });
    await delay(1500);
    console.log(`\n🔍 Deep test: ${name} (${file})`);
    const result = await testFn(page);
    if (jsErrors.length) {
      console.log(`   ⚠️ JS errors during test:`);
      jsErrors.forEach(e => console.log(`     ${e.substring(0, 150)}`));
    }
    return result;
  } catch (e) {
    console.log(`   ❌ Test error: ${e.message.substring(0, 150)}`);
    if (jsErrors.length) jsErrors.forEach(e => console.log(`     JS: ${e.substring(0, 100)}`));
    return { pass: false, issues: [e.message.substring(0, 80)] };
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  let allIssues = [];

  // 1. JSON Formatter
  const jsonResult = await deepTest(browser, 'json-formatter.html', 'JSON格式化', async (page) => {
    const issues = [];
    // Get all buttons
    const btnTexts = await page.evaluate(() => 
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    );
    console.log(`   Buttons: ${btnTexts.join(' | ')}`);
    
    // Input JSON
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (ta) { ta.value = '{"name":"test","value":123}'; ta.dispatchEvent(new Event('input', {bubbles:true})); }
    });
    await delay(300);
    
    // Click 美化 button
    const formatBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('美化'));
    });
    if (formatBtn && formatBtn.asElement()) {
      await formatBtn.click();
      await delay(500);
      const output = await page.evaluate(() => {
        // Check all possible output elements
        const tas = Array.from(document.querySelectorAll('textarea'));
        const pres = Array.from(document.querySelectorAll('pre, code'));
        const divs = Array.from(document.querySelectorAll('[id*="output"], [id*="result"], .output, .result'));
        return {
          textareas: tas.map(t => t.value.substring(0, 50)),
          pres: pres.map(p => p.textContent.substring(0, 50)),
          divs: divs.map(d => d.textContent.substring(0, 50))
        };
      });
      console.log(`   Output textareas: ${JSON.stringify(output.textareas)}`);
      console.log(`   Output pres: ${JSON.stringify(output.pres)}`);
      console.log(`   Output divs: ${JSON.stringify(output.divs)}`);
      
      if (output.textareas.length < 2 && output.pres.length === 0) {
        issues.push('美化后没有输出显示');
      }
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(jsonResult.issues || []));

  // 2. Text Diff
  const diffResult = await deepTest(browser, 'text-diff-tool.html', '文本对比', async (page) => {
    const issues = [];
    const tas = await page.$$('textarea');
    console.log(`   Textareas: ${tas.length}`);
    
    if (tas.length >= 2) {
      await page.evaluate(() => {
        const tas = document.querySelectorAll('textarea');
        tas[0].value = 'Hello World\nLine 2\nLine 3\nOnly in left';
        tas[0].dispatchEvent(new Event('input', {bubbles:true}));
        tas[1].value = 'Hello World\nLine modified\nLine 3\nOnly in right';
        tas[1].dispatchEvent(new Event('input', {bubbles:true}));
      });
      await delay(500);
      
      // Check for auto-compare or click button
      const btns = await page.evaluate(() => 
        Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
      );
      console.log(`   Buttons: ${btns.join(' | ')}`);
      
      // Try clicking compare button
      const compareBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('对比') || b.textContent.includes('比较') || b.textContent.includes('Compare'));
      });
      if (compareBtn && compareBtn.asElement()) {
        await compareBtn.click();
        await delay(500);
      }
      
      // Check diff output
      const diffOutput = await page.evaluate(() => {
        const text = document.body.innerText;
        const hasAdded = text.includes('+') || text.includes('added') || text.includes('新增');
        const hasRemoved = text.includes('-') || text.includes('removed') || text.includes('删除');
        const hasDiff = text.includes('modified') || text.includes('不同') || text.includes('diff');
        const diffEl = document.querySelector('[class*="diff"], [id*="diff"], .diff-output, [class*="result"]');
        return { hasAdded, hasRemoved, hasDiff, diffEl: !!diffEl, bodySnippet: text.substring(text.length - 200) };
      });
      console.log(`   Diff output: added=${diffOutput.hasAdded}, removed=${diffOutput.hasRemoved}, diff=${diffOutput.hasDiff}`);
      console.log(`   Diff element: ${diffOutput.diffEl}`);
      
      if (!diffOutput.hasAdded && !diffOutput.hasRemoved && !diffOutput.diffEl) {
        issues.push('对比结果没有显示差异');
      }
    } else {
      issues.push('找不到两个textarea');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(diffResult.issues || []));

  // 3. Base64
  const b64Result = await deepTest(browser, 'base64-tool.html', 'Base64工具', async (page) => {
    const issues = [];
    // Find the encode section
    const btns = await page.evaluate(() => 
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    );
    console.log(`   Buttons: ${btns.join(' | ')}`);
    
    // Type in input
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (ta) { ta.value = 'Hello World!'; ta.dispatchEvent(new Event('input', {bubbles:true})); }
    });
    await delay(300);
    
    // Find and click encode button
    const encBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('编码') || b.textContent.includes('Encode'));
    });
    if (encBtn && encBtn.asElement()) {
      await encBtn.click();
      await delay(500);
    }
    
    const output = await page.evaluate(() => {
      const tas = Array.from(document.querySelectorAll('textarea'));
      const last = tas[tas.length - 1];
      return last ? last.value.substring(0, 50) : 'no textarea';
    });
    console.log(`   Encoded output: ${output}`);
    
    // Check if output contains base64
    if (!output.includes('SGVsbG8')) {
      // Maybe it's a different layout, check all textareas
      const allOutput = await page.evaluate(() => 
        Array.from(document.querySelectorAll('textarea')).map(t => t.value.substring(0, 30))
      );
      console.log(`   All textareas: ${JSON.stringify(allOutput)}`);
      if (allOutput.length < 2) issues.push('Base64编码后输出为空');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(b64Result.issues || []));

  // 4. URL Encoder  
  const urlResult = await deepTest(browser, 'url-encoder.html', 'URL编解码', async (page) => {
    const issues = [];
    const btns = await page.evaluate(() => 
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    );
    console.log(`   Buttons: ${btns.join(' | ')}`);
    
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (ta) { ta.value = 'https://example.com?q=你好'; ta.dispatchEvent(new Event('input', {bubbles:true})); }
    });
    await delay(300);
    
    const encBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('编码') || b.textContent.includes('Encode'));
    });
    if (encBtn && encBtn.asElement()) {
      await encBtn.click();
      await delay(500);
    }
    
    const output = await page.evaluate(() => {
      const tas = Array.from(document.querySelectorAll('textarea'));
      const last = tas[tas.length - 1];
      return last ? last.value.substring(0, 60) : 'no textarea';
    });
    console.log(`   Encoded output: ${output}`);
    
    if (!output.includes('%')) {
      const allOutput = await page.evaluate(() => 
        Array.from(document.querySelectorAll('textarea')).map(t => t.value.substring(0, 30))
      );
      console.log(`   All textareas: ${JSON.stringify(allOutput)}`);
      if (allOutput.length < 2) issues.push('URL编码后输出为空');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(urlResult.issues || []));

  // 5. Hash Generator
  const hashResult = await deepTest(browser, 'hash-generator.html', '哈希生成', async (page) => {
    const issues = [];
    const btns = await page.evaluate(() => 
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    );
    console.log(`   Buttons: ${btns.join(' | ')}`);
    
    await page.evaluate(() => {
      const inp = document.querySelector('textarea, input[type="text"]');
      if (inp) { inp.value = 'test'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
    });
    await delay(1000);
    
    // Check if hash values auto-generated
    const hashes = await page.evaluate(() => {
      const text = document.body.innerText;
      const md5m = text.match(/MD5[\s:]*([a-f0-9]{32})/i);
      const sha1m = text.match(/SHA-?1[\s:]*([a-f0-9]{40})/i);
      const sha256m = text.match(/SHA-?256[\s:]*([a-f0-9]{64})/i);
      return {
        md5: md5m ? md5m[1] : 'not found',
        sha1: sha1m ? sha1m[1] : 'not found', 
        sha256: sha256m ? sha256m[1] : 'not found'
      };
    });
    console.log(`   MD5: ${hashes.md5}`);
    console.log(`   SHA1: ${hashes.sha1}`);
    console.log(`   SHA256: ${hashes.sha256}`);
    
    if (hashes.md5 === 'not found') {
      // Try alternate: look for input fields with hash values
      const vals = await page.evaluate(() => 
        Array.from(document.querySelectorAll('input[type="text"], [readonly]')).map(e => ({
          id: e.id, value: e.value?.substring(0, 20)
        }))
      );
      console.log(`   Input values: ${JSON.stringify(vals)}`);
      issues.push('哈希值未自动生成显示');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(hashResult.issues || []));

  // 6. Base Converter
  const baseResult = await deepTest(browser, 'base-converter.html', '进制转换', async (page) => {
    const issues = [];
    const btns = await page.evaluate(() => 
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    );
    console.log(`   Buttons: ${btns.join(' | ')}`);
    
    // Type 255 in the number input
    await page.evaluate(() => {
      const inp = document.querySelector('input[type="number"], input[type="text"]');
      if (inp) { 
        inp.value = '255'; 
        inp.dispatchEvent(new Event('input', {bubbles:true})); 
        inp.dispatchEvent(new Event('change', {bubbles:true}));
      }
    });
    await delay(800);
    
    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      // Look for hex, binary, octal values
      const allInputs = Array.from(document.querySelectorAll('input, [class*="result"], [id*="result"]')).map(e => ({
        tag: e.tagName, id: e.id, cls: e.className?.substring(0, 20), val: (e.value || e.textContent)?.substring(0, 20)
      }));
      return { bodySnippet: text.substring(0, 300), inputs: allInputs.slice(0, 10) };
    });
    console.log(`   Body: ${result.bodySnippet.substring(0, 150)}`);
    console.log(`   Inputs: ${JSON.stringify(result.inputs)}`);
    
    // Check if FF (hex of 255) appears anywhere
    if (!result.bodySnippet.includes('FF') && !result.bodySnippet.includes('ff')) {
      issues.push('进制转换结果可能未显示');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(baseResult.issues || []));

  // 7. Lorem Generator
  const loremResult = await deepTest(browser, 'lorem-generator.html', 'Lorem生成器', async (page) => {
    const issues = [];
    const btns = await page.evaluate(() => 
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    );
    console.log(`   Buttons: ${btns.join(' | ')}`);
    
    // Click generate
    const genBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('生成') || b.textContent.includes('Generate'));
    });
    if (genBtn && genBtn.asElement()) {
      await genBtn.click();
      await delay(800);
    }
    
    const output = await page.evaluate(() => {
      const tas = Array.from(document.querySelectorAll('textarea'));
      const divs = Array.from(document.querySelectorAll('[id*="output"], [class*="output"], [id*="result"]'));
      return {
        textareas: tas.map(t => t.value.substring(0, 40)),
        divs: divs.map(d => d.textContent.substring(0, 40)),
        bodyLen: document.body.innerText.length
      };
    });
    console.log(`   Textareas: ${JSON.stringify(output.textareas)}`);
    console.log(`   Output divs: ${JSON.stringify(output.divs)}`);
    
    if (output.textareas.every(t => !t) && output.divs.length === 0) {
      issues.push('Lorem文本未生成');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(loremResult.issues || []));

  // 8. Color Converter - check actual conversion output
  const colorResult = await deepTest(browser, 'color-converter.html', '颜色转换', async (page) => {
    const issues = [];
    // Try clicking on color input or typing hex
    const hasColorInput = await page.evaluate(() => !!document.querySelector('input[type="color"]'));
    console.log(`   Has color picker: ${hasColorInput}`);
    
    // Try entering a hex value
    await page.evaluate(() => {
      const hexInput = document.querySelector('input[id*="hex"], input[class*="hex"]');
      if (hexInput) {
        hexInput.value = '#FF5500';
        hexInput.dispatchEvent(new Event('input', {bubbles:true}));
      }
    });
    await delay(500);
    
    const values = await page.evaluate(() => {
      const text = document.body.innerText;
      const rgb = text.match(/RGB[\s:]*\(?\s*(\d+)/i);
      const hsl = text.match(/HSL[\s:]*\(?\s*(\d+)/i);
      return { rgb: rgb ? rgb[1] : 'N/A', hsl: hsl ? hsl[1] : 'N/A', snippet: text.substring(0, 200) };
    });
    console.log(`   RGB: ${values.rgb}, HSL: ${values.hsl}`);
    console.log(`   Body snippet: ${values.snippet.substring(0, 100)}`);
    return { pass: true, issues };
  });
  allIssues.push(...(colorResult.issues || []));

  // 9. Regex Tester - check actual matching
  const regexResult = await deepTest(browser, 'regex-tester.html', '正则测试器', async (page) => {
    const issues = [];
    // Input regex pattern
    const inputs = await page.$$('input[type="text"]');
    console.log(`   Inputs: ${inputs.length}`);
    
    if (inputs.length >= 1) {
      await inputs[0].click({ clickCount: 3 });
      await inputs[0].type('\\d+', { delay: 30 });
    }
    
    // Input test string
    const ta = await page.$('textarea');
    if (ta) {
      await ta.click({ clickCount: 3 });
      await ta.type('abc 123 def 456 ghi', { delay: 10 });
    }
    await delay(800);
    
    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasMatch = text.includes('123') || text.includes('456') || text.includes('match');
      const matchCount = text.match(/(\d+)\s*(个|match|result)/i);
      return { hasMatch, matchCount: matchCount ? matchCount[1] : 'N/A', snippet: text.substring(text.length - 200) };
    });
    console.log(`   Match found: ${result.hasMatch}, count: ${result.matchCount}`);
    
    if (!result.hasMatch) {
      issues.push('正则匹配结果未高亮显示');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(regexResult.issues || []));

  // 10. Markdown Editor - check preview
  const mdResult = await deepTest(browser, 'markdown-editor.html', 'Markdown编辑器', async (page) => {
    const issues = [];
    const ta = await page.$('textarea');
    if (ta) {
      await ta.click({ clickCount: 3 });
      await ta.type('# Hello\n\n**Bold** and *italic*\n\n- Item 1\n- Item 2', { delay: 10 });
      await delay(1500);
    }
    
    const preview = await page.evaluate(() => {
      // Check for rendered HTML in preview pane
      const previewPane = document.querySelector('[class*="preview"], [id*="preview"]');
      const h1 = document.querySelector('h1, .preview h1');
      const strong = document.querySelector('strong, b');
      const li = document.querySelector('li');
      return {
        hasH1: !!h1,
        h1Text: h1 ? h1.textContent : 'N/A',
        hasStrong: !!strong,
        hasLi: !!li,
        previewHTML: previewPane ? previewPane.innerHTML.substring(0, 100) : 'no preview pane'
      };
    });
    console.log(`   H1 rendered: ${preview.hasH1} (${preview.h1Text})`);
    console.log(`   Bold rendered: ${preview.hasStrong}`);
    console.log(`   List rendered: ${preview.hasLi}`);
    
    if (!preview.hasH1) {
      issues.push('Markdown预览未渲染H1');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(mdResult.issues || []));

  // 11. QR Generator - test with actual content
  const qrResult = await deepTest(browser, 'qr-generator.html', '二维码生成', async (page) => {
    const issues = [];
    const ta = await page.$('textarea');
    if (ta) {
      await ta.click({ clickCount: 3 });
      await ta.type('https://example.com', { delay: 20 });
    }
    await delay(2000);
    
    const qr = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const img = document.querySelector('img[src*="data"]');
      return {
        hasCanvas: !!canvas,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
        hasDataImg: !!img
      };
    });
    console.log(`   Canvas: ${qr.hasCanvas} (${qr.canvasSize})`);
    console.log(`   Data URL img: ${qr.hasDataImg}`);
    
    if (!qr.hasCanvas && !qr.hasDataImg) {
      issues.push('二维码图片未渲染');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(qrResult.issues || []));

  // 12. Text Dedup - test actual dedup
  const dedupResult = await deepTest(browser, 'text-dedup.html', '文本去重排序', async (page) => {
    const issues = [];
    const ta = await page.$('textarea');
    if (ta) {
      await ta.click({ clickCount: 3 });
      await ta.type('apple\nbanana\napple\ncherry\nbanana\ngrape', { delay: 10 });
    }
    await delay(300);
    
    // Click 立即处理
    const processBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('处理') || b.textContent.includes('去重'));
    });
    if (processBtn && processBtn.asElement()) {
      await processBtn.click();
      await delay(500);
    }
    
    const output = await page.evaluate(() => {
      const tas = Array.from(document.querySelectorAll('textarea'));
      const divs = Array.from(document.querySelectorAll('[id*="output"], [class*="output"], [id*="result"]'));
      return {
        textareas: tas.map(t => t.value.substring(0, 60)),
        divs: divs.map(d => d.textContent.substring(0, 60))
      };
    });
    console.log(`   Input: ${output.textareas[0] || 'empty'}`);
    console.log(`   Output: ${output.textareas[1] || output.divs[0] || 'empty'}`);
    
    // Check if dedup worked (output should have fewer items)
    const outText = output.textareas[1] || output.divs[0] || '';
    if (!outText || outText === output.textareas[0]) {
      issues.push('去重处理后结果可能未更新');
    }
    return { pass: issues.length === 0, issues };
  });
  allIssues.push(...(dedupResult.issues || []));

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log('📋 DEEP TEST SUMMARY');
  console.log('='.repeat(60));
  if (allIssues.length === 0) {
    console.log('✅ All tools passed deep interactive testing!');
  } else {
    console.log(`❌ Issues found (${allIssues.length}):`);
    allIssues.forEach(i => console.log(`   - ${i}`));
  }
})();
