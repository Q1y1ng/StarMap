import { readFileSync } from 'fs';
const d = readFileSync('/dev/stdin', 'utf8');
const r = JSON.parse(d);
let errs = 0, warns = 0;
for (const f of r) {
  if (!f.messages.length) continue;
  const parts = f.filePath.replace(/\\/g, '/').split('/');
  console.log(parts.slice(-3).join('/'));
  for (const m of f.messages) {
    const sev = m.severity === 1 ? 'W' : 'E';
    if (m.severity === 2) errs++; else warns++;
    console.log(`  L${m.line}:C${m.column} [${sev}] ${m.ruleId}: ${m.message.split('\n')[0]}`);
  }
}
console.log(`\nFiles with issues: ${r.filter(f => f.messages.length).length}`);
console.log(`Total errors: ${errs}, warnings: ${warns}`);
