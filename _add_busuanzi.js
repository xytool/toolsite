const fs = require('fs');
const path = 'C:\\Users\\miao\\.qclaw\\workspace\\toolsite\\index.html';

let html = fs.readFileSync(path, 'utf8');

// 1. 在 </head> 前加入不蒜子JS
html = html.replace('</head>', '  <script async src="//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"></script>\n</head>');

// 2. 在第一个 </section> 后（hero区后）加入访问统计显示
html = html.replace('  </section>\n\n  <!-- 图片处理 -->', 
    '  </section>\n\n  <!-- 访问统计 -->\n  <div style="text-align:center;padding:16px;color:#6b7280;font-size:14px;">\n    <span id="busuanzi_container_site_pv">总访问量 <span id="busuanzi_value_site_pv"></span> 次</span>\n    &nbsp;|&nbsp;\n    <span id="busuanzi_container_site_uv">访客数 <span id="busuanzi_value_site_uv"></span> 人</span>\n  </div>\n\n  <!-- 图片处理 -->'
  );

fs.writeFileSync(path, html, 'utf8');
console.log('不蒜子统计代码已添加');
