import { marked } from 'marked';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

const ROOT = 'e:/exam-pilot';
const MD_PATH = path.join(ROOT, 'docs/software-copyright/StarMap智能学情分析平台_V1.2.0_软件说明书完整版.md');
const PDF_PATH = path.join(ROOT, 'docs/software-copyright/StarMap智能学情分析平台_V1.2.0_软件说明书.pdf');
const SCREENSHOTS_DIR = path.join(ROOT, 'docs/software-copyright/screenshots');
const CHROME_PATH = 'C:\\Users\\s3431\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1223\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

const STYLES = `
@import url('https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf');
@page {
  size: A4;
  margin: 2.5cm 2cm 2.5cm 2cm;
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
.cover-page {
  page-break-after: always;
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
/* Caption styling under figures */
figure {
  margin: 0;
  text-align: center;
  page-break-inside: avoid;
}
figcaption {
  font-size: 9.5pt;
  color: #555;
  margin-top: 2px;
  margin-bottom: 12px;
  text-indent: 0;
}
`;

const COVER_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>${STYLES}</style>
</head>
<body>

<div class="cover-page" style="text-align:center;padding-top:200px;">
  <h1 style="font-size:28pt;margin-bottom:20px;border:none;">StarMap 智能学情分析平台</h1>
  <h2 style="font-size:20pt;color:#555;margin-bottom:40px;">软件说明书</h2>
  <table style="margin:0 auto;font-size:12pt;line-height:2.5;border:none;">
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">软件名称：</td><td style="font-weight:bold;border:none;">StarMap 智能学情分析平台</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">版本号：</td><td style="font-weight:bold;border:none;">V1.2.0</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">完成日期：</td><td style="font-weight:bold;border:none;">2026年6月11日</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;border:none;">开发单位：</td><td style="font-weight:bold;border:none;">罗浩泽（个人独立开发）</td></tr>
  </table>
</div>

`;

const HEADER_HTML = `StarMap智能学情分析平台 V1.2.0`;

async function generatePdf(htmlContent, pdfPath, opts = {}) {
  const tmpHtml = pdfPath.replace(/\.pdf$/, '.html');
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>${STYLES}</style>
</head>
<body>
${htmlContent}
</body>
</html>`;

  fs.writeFileSync(tmpHtml, fullHtml, 'utf-8');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto('file://' + tmpHtml.replace(/\\/g, '/'), {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.evaluate(async () => { await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 500));

  let headerTemplate = '<div></div>';
  if (opts.showHeader) {
    headerTemplate = `<div style="width:100%;font-size:8pt;color:#555;font-family:'Noto Sans CJK SC',sans-serif;display:flex;justify-content:space-between;border-bottom:1px solid #ccc;padding:0 0 2px 0;margin:0 2cm;">
  <span>${HEADER_HTML}</span>
  <span>第 <span class="pageNumber"></span> 页</span>
</div>`;
  }

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: opts.showHeader
      ? { top: '2.8cm', bottom: '2cm', left: '2cm', right: '2cm' }
      : { top: '2.5cm', bottom: '1.5cm', left: '2cm', right: '2cm' },
    printBackground: false,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate: '<div></div>',
  });

  await browser.close();

  // Clean up temp HTML
  try { fs.unlinkSync(tmpHtml); } catch {}
  return pdfPath;
}

// ==================== Main ====================

// Read and process markdown
let mdContent = fs.readFileSync(MD_PATH, 'utf-8');

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

// Parse markdown to HTML
console.log('Parsing markdown...');
const bodyHtml = await marked.parse(mdContent, { breaks: true, gfm: true });

// Split at the start of Chapter 1 (body content)
const bodyStart = '<h1>第一章 软件概述</h1>';
const splitIdx = bodyHtml.indexOf(bodyStart);
if (splitIdx === -1) throw new Error('Could not find Chapter 1 heading in HTML');

// Strip the initial cover title block (already in COVER_HTML) by starting after first <hr>
const firstHr = bodyHtml.indexOf('<hr>');
const coverTocHtml = firstHr >= 0 ? bodyHtml.substring(firstHr, splitIdx) : bodyHtml.substring(0, splitIdx);
const contentHtml = bodyHtml.substring(splitIdx);

// Paths for temp PDFs
const COVER_PDF = PDF_PATH.replace('.pdf', '-cover.pdf');
const BODY_PDF = PDF_PATH.replace('.pdf', '-body.pdf');

// Generate cover+TOC PDF (no header)
console.log('Generating cover + TOC PDF...');
await generatePdf(COVER_HTML + coverTocHtml, COVER_PDF, { showHeader: false });

// Generate body PDF (with header)
console.log('Generating body PDF with headers...');
await generatePdf(contentHtml, BODY_PDF, { showHeader: true });

// Merge PDFs using pdf-lib
console.log('Merging PDFs...');
const coverBytes = fs.readFileSync(COVER_PDF);
const bodyBytes = fs.readFileSync(BODY_PDF);

const mergedPdf = await PDFDocument.create();
const coverDoc = await PDFDocument.load(coverBytes);
const bodyDoc = await PDFDocument.load(bodyBytes);

const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
coverPages.forEach(page => mergedPdf.addPage(page));

const bodyPages = await mergedPdf.copyPages(bodyDoc, bodyDoc.getPageIndices());
bodyPages.forEach(page => mergedPdf.addPage(page));

const mergedBytes = await mergedPdf.save();
fs.writeFileSync(PDF_PATH, mergedBytes);

// Clean up temp PDFs
try { fs.unlinkSync(COVER_PDF); } catch {}
try { fs.unlinkSync(BODY_PDF); } catch {}

// Verify
const pdfStats = fs.statSync(PDF_PATH);
const finalBuf = fs.readFileSync(PDF_PATH);
const pageCount = (finalBuf.toString().match(/\/Type\s*\/Page[^s]/g) || []).length;

console.log(`\nDone! PDF generated: ${PDF_PATH}`);
console.log(`Pages: ${pageCount}, Size: ${(pdfStats.size / 1024).toFixed(0)} KB`);
