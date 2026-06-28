/**
 * Phase 20A-R - Script 1: PaddleOCR Baseline
 * Calls PaddleOCR GPU service for each exam image.
 * Usage: npx tsx scripts/run-paddle-baseline.ts
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const SAMPLE = path.join(root, "sample");
const OUT_DIR = path.join(root, "research-data/benchmark/paddle");
const OCR_URL = "http://localhost:8000";
const HEALTH_URL = OCR_URL + "/health";
const OCR_ENDPOINT = OCR_URL + "/ocr";

interface CaseDef {
  id: string; subject: string; student: string;
  paperPattern: string; answerPattern: string; scorePattern: string;
  gt: { totalScore: number; studentScore: number };
}

const CASES: CaseDef[] = [
  { id: "case-001", subject: "语文", student: "LY", paperPattern: "语文试卷", answerPattern: "YL语文答题卡", scorePattern: "YL语文小分", gt: { totalScore: 150, studentScore: 51 } },
  { id: "case-002", subject: "英语", student: "LY", paperPattern: "英语试卷", answerPattern: "YL英语答题卡", scorePattern: "YL英语小分", gt: { totalScore: 100, studentScore: 60 } },
  { id: "case-003", subject: "物理", student: "LY", paperPattern: "物理试卷", answerPattern: "YL物理答题卡", scorePattern: "YL物理小分", gt: { totalScore: 100, studentScore: 51 } },
  { id: "case-004", subject: "化学", student: "LY", paperPattern: "化学试卷", answerPattern: "YL化学答题卡", scorePattern: "YL化学小分", gt: { totalScore: 100, studentScore: 58 } },
  { id: "case-005", subject: "地理", student: "HZ", paperPattern: "地理试卷", answerPattern: "HZ地理答题卡", scorePattern: "HZ地理小分", gt: { totalScore: 100, studentScore: 66 } },
];

function findFiles(dir: string, pattern: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.includes(pattern) && /\.(jpg|png)$/i.test(f))
    .sort()
    .map(f => path.join(dir, f));
}

async function callOCR(filePath: string): Promise<any> {
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf]);
  const form = new FormData();
  form.append("file", blob, path.basename(filePath));
  const res = await fetch(OCR_ENDPOINT, { method: "POST", body: form });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function main() {
  console.log("[paddle-baseline] Starting...");

  // Check health
  try {
    const h = await fetch(HEALTH_URL).then(r => r.json());
    if (h.status !== "ok") throw new Error(h.status);
  } catch (e: any) {
    console.error("[paddle-baseline] Server unavailable:", e.message);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify({ status: "SERVICE_UNAVAILABLE" }));
    console.log("[paddle-baseline] Written unavailable status");
    return;
  }

  console.log("[paddle-baseline] Server OK (GPU)\n");

  let totalPages = 0;
  let totalBlocks = 0;
  const results: any[] = [];

  for (const c of CASES) {
    const paperImg = findFiles(path.join(SAMPLE, "试卷"), c.paperPattern).map(p => ({ path: p, category: "paper" }));
    const answerImg = findFiles(path.join(SAMPLE, "答题卡"), c.answerPattern).map(p => ({ path: p, category: "answer" }));
    const scoreImg = findFiles(path.join(SAMPLE, "成绩小分"), c.scorePattern).map(p => ({ path: p, category: "score" }));
    const allImgs = [...paperImg, ...answerImg, ...scoreImg];
    totalPages += allImgs.length;

    console.log("--- " + c.id + " (" + c.subject + ") - " + allImgs.length + " images ---");

    const cr: any = {
      caseId: c.id, subject: c.subject, student: c.student,
      images: [], totalBlocks: 0, totalQuestions: 0,
    };

    for (const img of allImgs) {
      const fname = path.basename(img.path);
      process.stdout.write("  " + fname + "... ");
      try {
        const data = await callOCR(img.path);
        const blocks: any[] = data.blocks || [];
        const qCount = blocks.filter((b: any) => /^[\d一-十]+[\.\、\s]/.test(b.text.trim())).length;
        cr.totalBlocks += blocks.length;
        cr.totalQuestions += qCount;
        cr.images.push({ file: fname, category: img.category, blocks: blocks.length, questions: qCount });
        totalBlocks += blocks.length;
        console.log("" + blocks.length + " blocks, " + qCount + " questions");
      } catch (e: any) {
        console.log("ERROR: " + e.message);
        cr.images.push({ file: fname, category: img.category, error: e.message });
      }
    }

    results.push(cr);
  }

  const output = {
    status: "OK",
    generatedAt: new Date().toISOString(),
    aggregate: {
      method: "PaddleOCR",
      pages: totalPages,
      blocks: totalBlocks,
    },
    cases: results,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(output, null, 2));
  console.log("\n[paddle-baseline] Done. Processed " + totalPages + " pages, " + totalBlocks + " blocks");
  console.log("Output: " + OUT_DIR + "/results.json");
}

main().catch(e => { console.error(e); process.exit(1); });
