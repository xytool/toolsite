const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8080/json-formatter.html', { waitUntil: 'networkidle0', timeout: 15000 });
  await delay(1000);
  
  const info = await pg.evaluate(() => ({
    tas: Array.from(document.querySelectorAll('textarea')).map(t => ({
      id: t.id, cls: t.className, val: t.value.substring(0, 30)
    })),
    editables: Array.from(document.querySelectorAll('[contenteditable]')).map(d => ({
      id: d.id, cls: d.className, txt: d.textContent.substring(0, 30)
    })),
    inputs: Array.from(document.querySelectorAll('input[type="text"]')).map(i => ({
      id: i.id, cls: i.className, val: i.value.substring(0, 30)
    }))
  }));
  
  console.log('Textareas:', JSON.stringify(info.tas, null, 2));
  console.log('ContentEditables:', JSON.stringify(info.editables, null, 2));
  console.log('Inputs:', JSON.stringify(info.inputs, null, 2));

  // Now type in the first textarea and click format
  const ta = await pg.$('textarea');
  if (ta) {
    await ta.click();
    await ta.type('{"name":"test","value":123}', { delay: 10 });
    await delay(300);
    const btn = await pg.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('美化'));
    });
    if (btn && btn.asElement()) {
      await btn.click();
      await delay(500);
    }
    const after = await pg.evaluate(() => ({
      tas: Array.from(document.querySelectorAll('textarea')).map(t => ({
        id: t.id, val: t.value.substring(0, 50)
      })),
      pres: Array.from(document.querySelectorAll('pre, code')).map(p => ({
        cls: p.className, txt: p.textContent.substring(0, 50)
      }))
    }));
    console.log('After format - Textareas:', JSON.stringify(after.tas, null, 2));
    console.log('After format - Pres:', JSON.stringify(after.pres, null, 2));
  }

  await b.close();
})();
