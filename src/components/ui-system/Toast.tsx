'use client'

import { Toaster as SonnerToaster } from 'sonner'

/**
 * StarMap Toast 统一配置
 * 基于 Sonner (v2.0.7)
 *
 * 使用:
 *   import { toast } from 'sonner'
 *   toast.success('上传成功')
 *   toast.error('网络失败')
 *   toast.info('分析完成')
 *   toast.loading('处理中…')
 *   toast.dismiss()
 *
 * 位置: bottom-right
 * 主题: 跟随系统
 * 动画: 统一
 * 颜色: richColors (success=green, error=red, info=blue, warning=orange)
 */
export function ToastProvider() {
  return (
    <SonnerToaster
      richColors
      closeButton
      position="bottom-right"
      gap={10}
      toastOptions={{
        duration: 3000,
        className: 'text-sm',
      }}
    />
  )
}
