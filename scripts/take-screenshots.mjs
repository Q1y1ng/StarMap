// ── StarMap 自动软著截图脚本 ──
// 遍历所有页面，自动登录，截图保存
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, '..', 'docs', 'software-copyright', 'screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── 页面列表 ──
const PAGES = [
  { path: '/login', name: '01-login' },
  { path: '/dashboard', name: '02-dashboard' },
  { path: '/upload-exam', name: '03-upload-exam' },
  { path: '/exams', name: '04-exams' },
  { path: '/knowledge-map', name: '05-knowledge-map' },
  { path: '/knowledge-graph', name: '06-knowledge-graph' },
  { path: '/risk-dashboard', name: '07-risk-dashboard' },
  { path: '/learning-profile', name: '08-learning-profile' },
  { path: '/wrong-book', name: '09-wrong-book' },
  { path: '/study-plan', name: '10-study-plan' },
  { path: '/trends', name: '11-trends' },
  { path: '/analytics/feedback', name: '12-analytics-feedback' },
  { path: '/analytics/system', name: '13-analytics-system' },
  { path: '/settings', name: '14-settings' },
  { path: '/admin', name: '15-admin' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // ── 1. Login ──
  console.log('[1/2] 正在登录...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 填写登录表单
  // 先切换到管理员登录标签
  const adminTab = page.locator('button', { hasText: '管理员登录' });
  if (await adminTab.isVisible()) {
    await adminTab.click();
    await page.waitForTimeout(300);
  }

  // 填写用户名和密码
  const inputs = page.locator('input');
  const inputCount = await inputs.count();

  // 填写用户名 (通常第一个input)
  await inputs.nth(0).fill('HEAOZIE');
  await page.waitForTimeout(200);

  // 填写密码 (通常第二个input)
  await inputs.nth(1).fill('123456');
  await page.waitForTimeout(200);

  // 点击登录按钮
  const loginBtn = page.locator('button[type="submit"]');
  if (await loginBtn.isVisible()) {
    await loginBtn.click();
  }

  // 等待登录完成并跳转（admin 用户会跳到 /admin，普通用户跳到 /dashboard）
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 });
  console.log('[1/2] 登录成功 ✅ 当前URL:', page.url());
  await page.waitForTimeout(1500);

  // ── 2. 截图每个页面 ──
  console.log('[2/2] 开始截图...');
  let count = 0;
  const failedPages = [];

  for (const { path, name } of PAGES) {
    try {
      const url = `${BASE_URL}${path}`;
      console.log(`  截图: ${name} (${url})`);

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // 等待页面内容加载
      await page.waitForTimeout(2000);

      // 等待框架动画完成
      try {
        await page.waitForSelector('[class*="motion"]', { timeout: 3000 });
      } catch {
        // motion 可能不在所有页面存在，忽略
      }

      // 额外等待确保动画完成
      await page.waitForTimeout(1500);

      const filePath = resolve(SCREENSHOT_DIR, `figure-${name}.png`);
      await page.screenshot({
        path: filePath,
        fullPage: true,
      });

      count++;
      console.log(`    ✅ ${name}.png 已保存`);
    } catch (err) {
      console.log(`    ❌ ${name} 截图失败: ${err.message}`);
      failedPages.push(name);
    }
  }

  console.log(`\n截图完成! 成功: ${count}/${PAGES.length}`);
  if (failedPages.length > 0) {
    console.log(`失败: ${failedPages.join(', ')}`);
  }

  await browser.close();
  return { total: PAGES.length, success: count, failed: failedPages };
}

main()
  .then((result) => {
    const summaryPath = resolve(SCREENSHOT_DIR, '_screenshot_summary.json');
    writeFileSync(summaryPath, JSON.stringify(result, null, 2));
    console.log(`\n截图摘要已保存: ${summaryPath}`);
  })
  .catch((err) => {
    console.error('截图脚本执行失败:', err);
    process.exit(1);
  });
