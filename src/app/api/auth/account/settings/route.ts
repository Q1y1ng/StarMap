// ── 用户 AI 设置 API ──
// GET  /api/auth/account/settings  → 获取当前用户的 apiKey、model、doubaoApiKey
// PATCH /api/auth/account/settings → 更新 apiKey、model、doubaoApiKey

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { DEFAULT_MODEL } from '@/lib/ai'

// ── GET ──

export async function GET() {
  try {
    const auth = await requireUser()
    if (auth.error) return auth.error

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { apiKey: true, model: true, doubaoApiKey: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        // 隐藏中间部分，只显示前后各 4 位
        apiKey: maskApiKey(user?.apiKey ?? undefined),
        hasApiKey: !!user?.apiKey,
        doubaoApiKey: maskApiKey(user?.doubaoApiKey ?? undefined),
        hasDoubaoApiKey: !!user?.doubaoApiKey,
        model: user?.model ?? DEFAULT_MODEL,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取设置失败'
    console.error('[api/auth/account/settings] GET Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── PATCH ──

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser()
    if (auth.error) return auth.error

    const body = await request.json()
    const { apiKey, model, doubaoApiKey } = body

    // 校验
    if (apiKey !== undefined && typeof apiKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'API Key 格式无效' },
        { status: 400 },
      )
    }
    if (doubaoApiKey !== undefined && typeof doubaoApiKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Doubao API Key 格式无效' },
        { status: 400 },
      )
    }

    // 构建更新数据（避免传入 undefined 触发 Prisma 空值警告）
    const updateData: Record<string, string | null> = {}
    if (apiKey !== undefined) updateData.apiKey = apiKey === '' ? null : apiKey
    if (model !== undefined) updateData.model = model === '' ? null : model
    if (doubaoApiKey !== undefined) updateData.doubaoApiKey = doubaoApiKey === '' ? null : doubaoApiKey

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: '无变更' })
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: updateData,
    })

    return NextResponse.json({ success: true, message: '设置已保存' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存设置失败'
    console.error('[api/auth/account/settings] PATCH Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── 工具 ──

function maskApiKey(key?: string): string | null {
  if (!key) return null
  if (key.length <= 8) return '****' + key.slice(-4)
  return key.slice(0, 4) + '****' + key.slice(-4)
}
