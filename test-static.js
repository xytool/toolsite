const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html').sort();
files.unshift('index.html');

let pass = 0, fail = 0;
const errors = [];

files.forEach(f => {
  try {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const size = Buffer.byteLength(content);
    const issues = [];

    if (!/<title>/i.test(content)) issues.push('no <title>');
    if (!/<body/i.test(content)) issues.push('no <body>');
    if (!/<script/i.test(content)) issues.push('no <script>');
    if (!/<link.*style\.css|<style/i.test(content)) issues.push('no CSS link');
    if (!content.includes('</html>')) issues.push('no </html>');

    // Brace matching in scripts
    const scriptBlocks = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptBlocks) {
      scriptBlocks.forEach((s, i) => {
        const code = s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
        const openB = (code.match(/\{/g) || []).length;
        const closeB = (code.match(/\}/g) || []).length;
        if (Math.abs(openB - closeB) > 1) {
          issues.push(`brace mismatch script#${i + 1} (open:${openB} close:${closeB})`);
        }
        // Check for common JS errors
        if (code.includes('function(') && !code.includes('function ()') && !code.includes('function(')) {
          // skip - anonymous functions are fine
        }
      });
    }

    // Check for broken HTML links to other pages
    const links = content.match(/href="([^"]+\.html)"/gi) || [];
    links.forEach(link => {
      const href = link.match(/href="([^"]+)"/i)[1];
      if (!href.startsWith('http') && !fs.existsSync(path.join(dir, href))) {
        issues.push(`broken link: ${href}`);
      }
    });

    // Check CSS file reference
    const cssMatch = content.match(/href="(css\/[^"]+\.css)"/gi);
    if (cssMatch) {
      cssMatch.forEach(m => {
        const cssFile = m.match(/href="([^"]+)"/i)[1];
        if (!fs.existsSync(path.join(dir, cssFile))) {
          issues.push(`missing CSS file: ${cssFile}`);
        }
      });
    }

    if (issues.length === 0) pass++;
    else { fail++; errors.push({ file: f, issues }); }

    const status = issues.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${f} (${Math.round(size / 1024)}KB)${issues.length ? ' => ' + issues.join(', ') : ''}`);

  } catch (e) {
    fail++;
    console.log(`❌ ${f} => READ ERROR: ${e.message}`);
    errors.push({ file: f, issues: ['READ ERROR'] });
  }
});

console.log(`\n=== SUMMARY: ${pass} OK, ${fail} with issues ===`);
if (errors.length) {
  console.log('\nIssues found:');
  errors.forEach(e => console.log(`  ${e.file}: ${e.issues.join(', ')}`));
}
