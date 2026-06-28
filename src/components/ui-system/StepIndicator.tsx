'use client'

// ── 通用步骤指示器 ──────────────────────────────────
// 在 upload-paper、analysis-test、upload-score-breakdown 等多步骤流程中复用

export type Step = {
  key: string
  label: string
  icon: string
}

export function StepIndicator({ steps, stepIndex }: { steps: Step[]; stepIndex: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-0">
      {steps.map((s, i) => {
        const isActive = i === stepIndex
        const isPast = i < stepIndex
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  isPast
                    ? 'bg-success text-white'
                    : isActive
                      ? 'bg-accent text-white shadow-glass-elevated'
                      : 'bg-surface-tertiary text-text-tertiary'
                }`}
              >
                {isPast ? '✓' : s.icon}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium ${
                  isPast ? 'text-success' : isActive ? 'text-accent' : 'text-text-tertiary'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-2 mt-[-1.25rem] h-0.5 w-12 sm:w-20 ${
                  i < stepIndex ? 'bg-success' : 'bg-surface-tertiary'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
