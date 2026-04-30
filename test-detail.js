const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const dir = 'C:\\Users\\miao\\.qclaw\\workspace\\toolsite';

['base64-tool.html', 'url-encoder.html'].forEach(f => {
  console.log(`\n=== ${f} ===`);
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const scriptBlocks = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  scriptBlocks.forEach((block, i) => {
    const code = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    if (!code.trim()) return;
    
    try {
      acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
      console.log(`  Script #${i + 1}: OK`);
    } catch (e) {
      const lines = code.split('\n');
      const lineNum = e.loc ? e.loc.line : '?';
      const colNum = e.loc ? e.loc.column : '?';
      console.log(`  Script #${i + 1}: ERROR at line ${lineNum}, col ${colNum}: ${e.message}`);
      // Show surrounding lines
      const start = Math.max(0, lineNum - 3);
      const end = Math.min(lines.length, lineNum + 2);
      for (let j = start; j < end; j++) {
        const marker = j === lineNum - 1 ? '>>>' : '   ';
        console.log(`  ${marker} ${j + 1}: ${lines[j]}`);
      }
    }
  });
});
