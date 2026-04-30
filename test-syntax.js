// Precise JS syntax check using Node's built-in parser
const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\miao\\.qclaw\\workspace\\toolsite';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html').sort();
files.unshift('index.html');

let pass = 0, fail = 0;

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const scriptBlocks = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  let fileOk = true;
  scriptBlocks.forEach((block, i) => {
    const code = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    if (!code.trim()) return; // skip empty scripts
    
    try {
      new Function(code);
    } catch (e) {
      fileOk = false;
      console.log(`❌ ${f} script#${i + 1}: ${e.message}`);
    }
  });
  
  if (fileOk) {
    pass++;
    console.log(`✅ ${f} - JS syntax OK`);
  } else {
    fail++;
  }
});

console.log(`\n=== ${pass} OK, ${fail} FAILED ===`);
