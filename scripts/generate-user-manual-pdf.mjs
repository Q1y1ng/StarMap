import { marked } from 'marked';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MD_PATH = path.join(ROOT, 'docs/user-manual/StarMap用户手册.md');
const HTML_PATH = path.join(ROOT, 'docs/user-manual/_temp.html');
const PDF_PATH = path.join(ROOT, 'docs/user-manual/StarMap用户手册.pdf');
const SCREENSHOTS_DIR = path.join(ROOT, 'docs/software-copyright/screenshots');
const CHROME_PATH = 'C:\\Users\\s3431\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1223\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

const STYLES = `
@import url('https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf');
@page {
  size: A4;
  margin: 2.5cm 2cm 2.5cm 2cm;
  @bottom-center {
    content: counter(page);
    font-family: 'Noto Sans CJK SC', sans-serif;
    font-size: 9pt;
    color: #888;
  }
}
body {
  font-family: 'Noto Sans CJK SC', 'SimSun', sans-serif;
  font-size: 10.5pt;
  line-height: 1.8;
  color: #333;
}
h1 {
  font-size: 16pt;
  color: #1a1a1a;
  border-bottom: 2px solid #3b82f6;
  padding-bottom: 6px;
  margin-top: 32px;
  margin-bottom: 16px;
  page-break-after: avoid;
}
h2 {
  font-size: 14pt;
  color: #2563eb;
  margin-top: 24px;
  margin-bottom: 12px;
  page-break-after: avoid;
}
h3 {
  font-size: 12pt;
  color: #333;
  margin-top: 18px;
  margin-bottom: 8px;
  page-break-after: avoid;
}
h4, h5, h6 {
  font-size: 11pt;
  color: #444;
  margin-top: 14px;
  margin-bottom: 6px;
}
p {
  margin: 6px 0;
  text-indent: 2em;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 9.5pt;
}
th, td {
  border: 1px solid #ccc;
  padding: 6px 10px;
  text-align: left;
}
th {
  background-color: #f0f4ff;
  font-weight: bold;
}
tr:nth-child(even) td {
  background-color: #fafafa;
}
pre {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 9pt;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 10px 0;
}
code {
  font-family: 'Courier New', monospace;
  font-size: 9pt;
  background-color: #f0f0f0;
  padding: 1px 4px;
  border-radius: 2px;
}
pre code {
  background: none;
  padding: 0;
}
hr {
  border: none;
  border-top: 1px solid #ddd;
  margin: 24px 0;
}
li {
  margin: 3px 0;
  text-indent: 0;
}
img {
  max-width: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin: 12px 0;
  page-break-inside: avoid;
}
strong {
  font-weight: bold;
}
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }
@media print {
  a { color: #333; }
}
blockquote {
  margin: 12px 0;
  padding: 8px 16px;
  background-color: #f8f9fa;
  border-left: 3px solid #3b82f6;
  color: #555;
  font-size: 10pt;
}
`;

console.log('Reading markdown...');
let mdContent = fs.readFileSync(MD_PATH, 'utf-8');

// Replace image references with base64-encoded data URIs
console.log('Embedding screenshots as base64...');
mdContent = mdContent.replace(/!\[([^\]]*)\]\(screenshots\/([^)]+)\)/g, (match, alt, filename) => {
  const imgPath = path.join(SCREENSHOTS_DIR, filename);
  if (fs.existsSync(imgPath)) {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    const buffer = fs.readFileSync(imgPath);
    const base64 = buffer.toString('base64');
    const sizeKb = (buffer.length / 1024).toFixed(0);
    console.log(`  ${filename}: ${sizeKb} KB embedded`);
    return `![${alt}](data:image/${mimeType};base64,${base64})`;
  } else {
    console.warn(`  WARNING: ${filename} not found at ${imgPath}`);
    return match;
  }
});

console.log('Converting markdown to HTML...');
const bodyHtml = await marked.parse(mdContent, { breaks: true, gfm: true });

// Build full HTML with cover page
const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>${STYLES}</style>
</head>
<body>

<div style="page-break-after:always;text-align:center;padding-top:200px;">
  <h1 style="font-size:28pt;margin-bottom:20px;border:none;">StarMap 智能学情分析平台</h1>
  <h2 style="font-size:20pt;color:#555;margin-bottom:40px;">用户手册</h2>
  <table style="margin:0 auto;font-size:12pt;line-height:2.5;border:none;">
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">软件名称：</td><td style="font-weight:bold;border:none;">StarMap 智能学情分析平台</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">版本号：</td><td style="font-weight:bold;border:none;">V1.2.0</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">编写日期：</td><td style="font-weight:bold;border:none;">2026 年 6 月 9 日</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">文档类型：</td><td style="font-weight:bold;border:none;">用户手册</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">作者：</td><td style="font-weight:bold;border:none;">罗浩泽</td></tr>
  </table>
</div>

${bodyHtml}

</body>
</html>`;

// Write HTML file
fs.writeFileSync(HTML_PATH, fullHtml, 'utf-8');
console.log(`\nHTML written: ${HTML_PATH} (${(fullHtml.length / 1024).toFixed(0)} KB)`);

// Generate PDF using Playwright
console.log('Launching headless Chromium...');
const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
});

const page = await browser.newPage();
const absHtmlPath = path.resolve(HTML_PATH);
await page.goto('file://' + absHtmlPath.replace(/\\/g, '/'), {
  waitUntil: 'networkidle',
  timeout: 30000,
});

// Wait for fonts to load
await page.evaluate(async () => {
  await document.fonts.ready;
});

// Small delay for rendering
await new Promise(r => setTimeout(r, 500));

const pdfPathAbs = path.resolve(PDF_PATH);
await page.pdf({
  path: pdfPathAbs,
  format: 'A4',
  margin: { top: '2.5cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;text-align:center;font-size:9pt;color:#888;font-family:\'Noto Sans CJK SC\',sans-serif;"><span class="pageNumber"></span></div>',
});

await browser.close();

const pdfStats = fs.statSync(pdfPathAbs);
console.log(`\nPDF generated: ${PDF_PATH}`);
console.log(`Size: ${(pdfStats.size / 1024).toFixed(0)} KB`);

// Rough page count from file size vs expected content
const htmlSizeKb = fullHtml.length / 1024;
console.log(`Estimated pages from content: ~${Math.round(htmlSizeKb / 3)} pages`);
console.log('Done!');
