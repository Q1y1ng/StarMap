// ── StarMap 软著说明书 PDF 生成脚本 ──
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(__dirname, '..', 'docs', 'software-copyright');
const SCREENSHOTS_DIR = resolve(DOCS_DIR, 'screenshots');
const OUTPUT_PDF = resolve(DOCS_DIR, 'StarMap智能学情分析平台_V1.2.0_软件说明书.pdf');

// Chinese font URL for PDF
const CJK_FONT_URL = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf';

// ── Read combined markdown ──
const mdPath = resolve(DOCS_DIR, 'StarMap智能学情分析平台_V1.2.0_软件说明书完整版.md');
let markdown = readFileSync(mdPath, 'utf-8');

// ── Simple MD to HTML conversion ──
function mdToHtml(md) {
  let html = '';
  const lines = md.split('\n');
  let inCode = false;
  let codeBlock = '';
  let inTable = false;
  let tableHtml = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCode) {
        html += `<pre><code>${escapeHtml(codeBlock)}</code></pre>\n`;
        codeBlock = '';
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBlock += line + '\n';
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      html += '<hr />\n';
      continue;
    }

    // Headers
    if (line.startsWith('###### ')) { html += `<h6>${escapeHtml(line.slice(7))}</h6>\n`; continue; }
    if (line.startsWith('##### ')) { html += `<h5>${escapeHtml(line.slice(6))}</h5>\n`; continue; }
    if (line.startsWith('#### ')) { html += `<h4>${escapeHtml(line.slice(5))}</h4>\n`; continue; }
    if (line.startsWith('### ')) { html += `<h3>${escapeHtml(line.slice(4))}</h3>\n`; continue; }
    if (line.startsWith('## ')) { html += `<h2>${escapeHtml(line.slice(3))}</h2>\n`; continue; }
    if (line.startsWith('# ')) { html += `<h1>${escapeHtml(line.slice(2))}</h1>\n`; continue; }

    // Table handling
    if (line.trim().startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table>\n';
      }
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (line.includes('---')) continue; // skip separator

      // Check if header row (previous was separator)
      const prevLine = i > 0 ? lines[i-1] : '';
      const isHeader = i === 0 || prevLine.includes('---');

      tableHtml += '  <tr>\n';
      for (const cell of cells) {
        const tag = isHeader ? 'th' : 'td';
        tableHtml += `    <${tag}>${escapeHtml(cell)}</${tag}>\n`;
      }
      tableHtml += '  </tr>\n';

      // Check if next line is still table
      const nextLine = i + 1 < lines.length ? lines[i+1] : '';
      if (!nextLine.trim().startsWith('|')) {
        tableHtml += '</table>\n';
        html += tableHtml;
        inTable = false;
        tableHtml = '';
      }
      continue;
    }
    if (inTable) {
      tableHtml += '</table>\n';
      html += tableHtml;
      inTable = false;
      tableHtml = '';
    }

    // Bold
    let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // List items
    if (processed.match(/^[\s]*[-*]\s/)) {
      const content = processed.replace(/^[\s]*[-*]\s/, '');
      if (content.trim()) html += `<li>${content}</li>\n`;
      continue;
    }

    // HTML tags passthrough (don't wrap in <p>)
    if (processed.trim().startsWith('<div') || processed.trim().startsWith('<img')) {
      html += processed + '\n';
      continue;
    }

    // Empty line = paragraph break
    if (processed.trim() === '') {
      html += '<br/>\n';
      continue;
    }

    // Default paragraph
    html += `<p>${processed}</p>\n`;
  }

  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Embed screenshots into raw Markdown (before mdToHtml) ──
function embedScreenshots(md) {
  const screenshotFiles = existsSync(SCREENSHOTS_DIR)
    ? readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png') && !f.startsWith('_'))
    : [];

  for (const file of screenshotFiles) {
    const imgPath = resolve(SCREENSHOTS_DIR, file);
    const imgData = readFileSync(imgPath);
    const base64 = imgData.toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;

    // Replace figure reference lines with just the embedded image
    const imgTag = `<div style="text-align:center;margin:12px 0;page-break-inside:avoid;"><img src="${dataUri}" style="max-width:100%;border:1px solid #ddd;border-radius:4px;" /></div>`;
    md = md.replace(
      new RegExp(`\\*\\*截图文件\\*\\*：\`${file}\`\\s*\\n?`, 'g'),
      `${imgTag}\n`
    );
  }

  return md;
}

// ── Generate cover HTML ──
function generateCover() {
  return `
<div style="page-break-after:always;text-align:center;padding-top:200px;">
  <h1 style="font-size:28pt;margin-bottom:20px;">StarMap 智能学情分析平台</h1>
  <h2 style="font-size:20pt;color:#555;margin-bottom:40px;">软件说明书</h2>
  <table style="margin:0 auto;font-size:12pt;line-height:2.5;">
    <tr><td style="text-align:right;padding-right:16px;color:#888;">软件名称：</td><td style="font-weight:bold;">StarMap 智能学情分析平台</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;">版本号：</td><td style="font-weight:bold;">V1.2.0</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;">完成日期：</td><td style="font-weight:bold;">2026年6月9日</td></tr>
    <tr><td style="text-align:right;padding-right:16px;color:#888;">开发单位：</td><td style="font-weight:bold;">HEAOZIE</td></tr>
  </table>
</div>`;
}

// ── Generate TOC HTML ──
function generateTOC() {
  return `
<div style="page-break-after:always;">
  <h1 style="font-size:18pt;margin-bottom:20px;">目录</h1>
  <div style="font-size:11pt;line-height:2.2;">
    <p><a href="#ch1">第一章 软件概述</a></p>
    <p><a href="#ch2">第二章 运行环境</a></p>
    <p><a href="#ch3">第三章 系统架构设计</a></p>
    <p><a href="#ch4">第四章 功能模块设计</a></p>
    <p><a href="#ch5">第五章 数据库设计</a></p>
    <p><a href="#ch6">第六章 核心业务流程</a></p>
    <p><a href="#ch7">第七章 接口设计</a></p>
    <p><a href="#ch8">第八章 关键技术实现</a></p>
    <p><a href="#ch9">第九章 用户操作手册</a></p>
    <p><a href="#ch10">第十章 页面展示</a></p>
    <p><a href="#ch11">第十一章 软件特点</a></p>
  </div>
</div>`;
}

// ── Add anchors to headings ──
function addAnchors(html) {
  const chapters = ['软件概述', '运行环境', '系统架构设计', '功能模块设计', '数据库设计',
    '核心业务流程', '接口设计', '关键技术实现', '用户操作手册', '页面展示', '软件特点'];

  chapters.forEach((ch, idx) => {
    const num = idx + 1;
    const anchor = `ch${num}`;
    html = html.replace(
      new RegExp(`<h1>第${zhNum(num)}章 ${ch}</h1>`),
      `<h1 id="${anchor}">第${zhNum(num)}章 ${ch}</h1>`
    );
  });
  return html;
}

function zhNum(n) {
  const map = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'];
  return map[n - 1] || String(n);
}

// ── Main ──
async function main() {
  console.log('正在生成 PDF...');

  // Embed screenshots into raw Markdown (before mdToHtml)
  markdown = embedScreenshots(markdown);

  // Convert MD to HTML
  let bodyHtml = mdToHtml(markdown);

  // Add chapter anchors
  bodyHtml = addAnchors(bodyHtml);

  // Build complete HTML
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  @import url('${CJK_FONT_URL}');
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
  .cover-page {
    page-break-after: always;
  }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  @media print {
    a { color: #333; }
  }
</style>
</head>
<body>
  ${generateCover()}
  ${generateTOC()}
  ${bodyHtml}
</body>
</html>`;

  // Write temp HTML for debugging
  const tempHtmlPath = resolve(DOCS_DIR, '_temp.html');
  writeFileSync(tempHtmlPath, fullHtml, 'utf-8');
  console.log(`临时 HTML 已写入: ${tempHtmlPath}`);

  // Use Playwright to generate PDF
  console.log('启动 Playwright 渲染...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();

  await page.goto('file:///' + tempHtmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  // Wait for fonts to load
  await page.waitForTimeout(3000);

  console.log('生成 PDF...');
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    margin: { top: '2.5cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;text-align:center;font-size:9pt;font-family:'Noto Sans CJK SC',sans-serif;color:#888;padding:0 2cm;">
        <span>StarMap 智能学情分析平台 V1.2.0</span>
        <span style="float:right;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</span>
      </div>
    `,
    printBackground: true,
    preferCSSPageSize: false,
  });

  await browser.close();

  // Get file size
  const stats = readFileSync(OUTPUT_PDF);
  const sizeKB = Math.round(stats.length / 1024);

  console.log(`\nPDF 生成完成！`);
  console.log(`路径: ${OUTPUT_PDF}`);
  console.log(`大小: ${sizeKB} KB`);
}

main().catch(err => {
  console.error('PDF 生成失败:', err);
  process.exit(1);
});
