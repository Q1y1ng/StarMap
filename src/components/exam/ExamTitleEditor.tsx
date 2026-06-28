'use client'

import { useState, useCallback } from 'react'
import { Pencil } from 'lucide-react'
import { Dialog } from '@/components/ui-system/Dialog'
import { Input } from '@/components/ui-system/Input'
import { Button } from '@/components/ui-system/Button'

type ExamTitleEditorProps = {
  examId: string
  initialTitle: string
}

export function ExamTitleEditor({ examId, initialTitle }: ExamTitleEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initialTitle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('考试名称不能为空')
      return
    }
    if (trimmed.length > 128) {
      setError('考试名称不能超过128个字符')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      const json = await res.json()
      if (json.success) {
        setTitle(trimmed)
        setOpen(false)
      } else {
        setError(json.error ?? '保存失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setSaving(false)
    }
  }, [draft, examId])

  const handleOpen = useCallback(() => {
    setDraft(title)
    setError(null)
    setOpen(true)
  }, [title])

  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <button
          onClick={handleOpen}
          className="rounded-full p-1.5 text-text-tertiary transition-colors hover:bg-accent-subtle hover:text-accent"
          title="修改考试名称"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="修改考试名称">
        <div className="space-y-4">
          <Input
            label="考试名称"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            error={error ?? undefined}
            autoFocus
            placeholder="输入考试名称"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
