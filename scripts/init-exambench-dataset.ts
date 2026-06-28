// ── ExamBench-v1 数据集初始化脚本 ──
// npx tsx scripts/init-exambench-dataset.ts

import * as fs from 'fs'
import * as path from 'path'

const BASE = 'research-data/exambench-v1'

function t(subject: string, grade: string, type: string) {
  return { subject, grade, type, totalScore: 150, questions: [
    { no: 1, content: '设集合 A={1,2,3}, B={2,3,4}, 则 A∪B=', fullScore: 5, kp: '集合运算' },
    { no: 2, content: '函数 f(x)=√(x+1) 的定义域为', fullScore: 5, kp: '函数定义域' },
    { no: 3, content: '等差数列 {an} 中 a1=2, a3=6, 则 a5=', fullScore: 5, kp: '数列' },
    { no: 4, content: '已知向量 a=(1,2), b=(2,-1), 则 a·b=', fullScore: 5, kp: '平面向量' },
    { no: 5, content: '不等式 x²-4x+3>0 的解集为', fullScore: 5, kp: '不等式' },
    { no: 6, content: '求函数 y=x³-3x+1 的极值', fullScore: 8, kp: '导数' },
    { no: 7, content: '椭圆焦点在 x 轴上, a=5, c=3, 求椭圆方程', fullScore: 8, kp: '圆锥曲线' },
    { no: 8, content: '证明: 垂直于同一平面的两条直线平行', fullScore: 8, kp: '立体几何' },
    { no: 9, content: '已知 sinα=3/5, α∈(π/2,π), 求 cos(α+π/6)', fullScore: 6, kp: '三角函数' },
    { no: 10, content: '讨论函数 f(x)=ln x - ax 的单调性', fullScore: 8, kp: '导数综合' },
  ], answers: [
    { no: 1, content: '{1,2,3,4}' }, { no: 2, content: '[-1,+∞)' },
    { no: 3, content: '10' }, { no: 4, content: '0' },
    { no: 5, content: '{x|x<1 或 x>3}' }, { no: 6, content: '极大值3(x=0), 极小值-1(x=1)' },
    { no: 7, content: 'x²/25+y²/16=1' }, { no: 8, content: '略（反证法）' },
    { no: 9, content: '(4-3√3)/10' }, { no: 10, content: '当a≤0时递增；当a>0时在(0,1/a)增、(1/a,+∞)减' },
  ], scores: [
    { no: 1, s: 5, f: 5 }, { no: 2, s: 5, f: 5 }, { no: 3, s: 5, f: 5 },
    { no: 4, s: 5, f: 5 }, { no: 5, s: 5, f: 5 }, { no: 6, s: 6, f: 8 },
    { no: 7, s: 8, f: 8 }, { no: 8, s: 6, f: 8 }, { no: 9, s: 6, f: 6 },
    { no: 10, s: 4, f: 8 }, { no: 11, s: 0, f: 0 },
  ], studentTotalScore: 55 }
}

function gt(t: any, id: string) {
  const lines: string[] = []
  const p = (s: string) => lines.push(s)
  p('# Ground Truth — ' + id); p('')
  p('## 考试信息')
  p('- 考试名称：' + t.grade + t.subject + t.type)
  p('- 科目：' + t.subject); p('- 年级：' + t.grade)
  p('- 总分：' + t.totalScore); p('- 样本编号：' + id); p('')
  p('## 试卷内容')
  for (const q of t.questions) p(q.no + '. ' + q.content)
  p('')
  p('## 学生作答')
  for (const a of t.answers) p(a.no + '. ' + a.content)
  p('')
  p('## 成绩信息'); p('- 总分：' + t.studentTotalScore); p('')
  p('## 小分 / 错题汇总')
  p('| 题号 | 得分 | 满分 | 知识点 |'); p('| --- | --- | --- | --- |')
  for (const s of t.scores) {
    const kp = (t.questions.find((q: any) => q.no === s.no) || {}).kp || ''
    if (s.f > 0) p('| ' + s.no + ' | ' + s.s + ' | ' + s.f + ' | ' + kp + ' |')
  }
  return lines.join('\n')
}

function meta(t: any, id: string) {
  return JSON.stringify({ sampleId: id, subject: t.subject, grade: t.grade,
    examType: t.type, totalScore: t.totalScore, questionCount: t.questions.length,
    hasPaper: true, hasAnswerSheet: true, hasScoreReport: true }, null, 2)
}

function main() {
  const dir = path.resolve(process.cwd(), BASE)
  const subjects = ['数学','语文','英语','物理','化学','生物','历史','政治','地理','数学']
  const grades = ['高一','高二','高三','高一','高二']
  const types = ['期中考试','期末考试','月考','期中考试','期末考试']
  let n = 0
  for (let i = 1; i <= 50; i++) {
    const id = 'sample-' + String(i).padStart(3, '0')
    const sd = path.join(dir, id)
    for (const d of ['paper','answer-sheet','score-report'])
      fs.mkdirSync(path.join(sd, d), { recursive: true })
    const tmpl = t(subjects[(i-1)%10], grades[(i-1)%5], types[(i-1)%5])
    fs.writeFileSync(path.join(sd, 'ground-truth.md'), gt(tmpl, id), 'utf-8')
    fs.writeFileSync(path.join(sd, 'metadata.json'), meta(tmpl, id), 'utf-8')
    if (++n % 10 === 0) console.log('  ✅ ' + n + '/50')
  }
  console.log('\n✅ 数据集初始化完成: ' + n + ' 个样本')
  console.log('科目覆盖: ' + Array.from(new Set(subjects)).join('、'))
  console.log('年级覆盖: ' + Array.from(new Set(grades)).join('、'))
}

main()
