// ── 测试 Vision 模型 ──
const res = await fetch('', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ark-ba5448dd-033c-4cff-a5d0-63f0a90f7a41-9a568'
  },
  body: JSON.stringify({
    model: '',
    messages: [{ role: 'user', content: 'Hi, what model are you? Reply in one sentence.' }],
    max_tokens: 50
  })
})

if (!res.ok) {
  const err = await res.text()
  console.error('HTTP', res.status, err)
  process.exit(1)
}

const data = await res.json()
console.log('model:', data.model)
console.log('usage:', JSON.stringify(data.usage))
console.log('reply:', data.choices?.[0]?.message?.content)
