'use client'

import { useState, useEffect, useCallback } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  Sun, Moon, Monitor, LogOut, Palette, Trash2, AlertTriangle, X,
  Key, Cpu, Check, Eye, EyeOff, Save, User, Shield, Calendar, Lock,
} from 'lucide-react'
import { GlassCard } from '@/components/ui-system/GlassCard'
import { Button } from '@/components/ui-system/Button'
import { Input } from '@/components/ui-system/Input'
import { PageHeader } from '@/components/ui-system/PageHeader'
import { Badge } from '@/components/ui-system/Badge'
import { useTheme } from '@/components/layout/ThemeContext'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
}

type ThemeOption = 'light' | 'dark' | 'system'

const THEME_OPTIONS: { value: ThemeOption; label: string; desc: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色模式', desc: '始终使用浅色界面', icon: Sun },
  { value: 'dark', label: '深色模式', desc: '始终使用深色界面', icon: Moon },
  { value: 'system', label: '跟随系统', desc: '自动适配系统外观', icon: Monitor },
]

const MODEL_OPTIONS = [
  { value: 'deepseek-chat', label: 'DeepSeek V4 Flash', desc: '快速、经济，适合日常分析' },
  { value: 'deepseek-reasoner', label: 'DeepSeek V4 Pro', desc: '更强推理能力，适合复杂分析' },
]

type AccountInfo = {
  id: string
  username: string
  name: string
  role: string
  roleLabel: string
  createdAt: string
  updatedAt: string
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)

  // ── 账户信息 ──
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)

  // ── 修改密码 ──
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── AI 设置 ──
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState('deepseek-chat')
  const [aiSaving, setAiSaving] = useState(false)
  const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(true)

  // ── Doubao 设置 ──
  const [doubaoApiKey, setDoubaoApiKey] = useState('')
  const [hasDoubaoApiKey, setHasDoubaoApiKey] = useState(false)
  const [maskedDoubaoKey, setMaskedDoubaoKey] = useState<string | null>(null)
  const [showDoubaoKey, setShowDoubaoKey] = useState(false)
  const [doubaoSaving, setDoubaoSaving] = useState(false)
  const [doubaoMessage, setDoubaoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── 注销账号状态 ──
  const [deleteState, setDeleteState] = useState<'idle' | 'counting' | 'confirming'>('idle')
  const [countdown, setCountdown] = useState(3)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── 加载账户信息 ──
  useEffect(() => {
    let mounted = true
    async function loadAccount() {
      try {
        const res = await fetch('/api/auth/account')
        const json = await res.json()
        if (mounted && json.success) {
          setAccountInfo(json.data)
        }
      } catch {
        // 静默失败
      } finally {
        if (mounted) setAccountLoading(false)
      }
    }
    loadAccount()
    return () => { mounted = false }
  }, [])

  // ── 加载 AI 设置 ──
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await fetch('/api/auth/account/settings')
        const json = await res.json()
        if (mounted && json.success) {
          setHasApiKey(json.data.hasApiKey)
          setMaskedKey(json.data.apiKey)
          setHasDoubaoApiKey(json.data.hasDoubaoApiKey)
          setMaskedDoubaoKey(json.data.doubaoApiKey)
          setSelectedModel(json.data.model || 'deepseek-chat')
        }
      } catch {
        // 静默失败
      } finally {
        if (mounted) setAiLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // ── 倒计时逻辑 ──
  useEffect(() => {
    if (deleteState !== 'counting') return
    if (countdown <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeleteState('confirming')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [deleteState, countdown])

  function startDeleteCountdown() {
    setDeleteState('counting')
    setCountdown(3)
    setDeleteError(null)
  }

  function cancelDelete() {
    setDeleteState('idle')
    setCountdown(3)
    setDeleteError(null)
  }

  async function confirmDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/auth/account', { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        await signOut({ callbackUrl: '/login' })
      } else {
        setDeleteError(json.error || '注销失败')
        setDeleteState('idle')
      }
    } catch {
      setDeleteError('注销失败，请稍后重试')
      setDeleteState('idle')
    } finally {
      setDeleting(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    await signOut({ callbackUrl: '/login' })
  }

  // ── 修改密码 ──
  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: '两次输入的新密码不一致' })
      return
    }
    setPasswordSaving(true)
    setPasswordMessage(null)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = await res.json()
      if (json.success) {
        setPasswordMessage({ type: 'success', text: '密码修改成功' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordMessage({ type: 'error', text: json.error || '修改失败' })
      }
    } catch {
      setPasswordMessage({ type: 'error', text: '修改失败，请稍后重试' })
    } finally {
      setPasswordSaving(false)
    }
  }

  // ── 保存 AI 设置 ──
  async function saveAiSettings() {
    setAiSaving(true)
    setAiMessage(null)
    try {
      const res = await fetch('/api/auth/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey || '',
          model: selectedModel,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setAiMessage({ type: 'success', text: '设置已保存' })
        setHasApiKey(!!apiKey)
        setMaskedKey(apiKey ? apiKey.slice(0, 4) + '****' + apiKey.slice(-4) : null)
        setApiKey('')
      } else {
        setAiMessage({ type: 'error', text: json.error || '保存失败' })
      }
    } catch {
      setAiMessage({ type: 'error', text: '保存失败，请稍后重试' })
    } finally {
      setAiSaving(false)
    }
  }

  // ── 保存 Doubao 设置 ──
  async function saveDoubaoSettings() {
    setDoubaoSaving(true)
    setDoubaoMessage(null)
    try {
      const res = await fetch('/api/auth/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doubaoApiKey: doubaoApiKey || '',
        }),
      })
      const json = await res.json()
      if (json.success) {
        setDoubaoMessage({ type: 'success', text: 'Doubao API Key 已保存' })
        setHasDoubaoApiKey(!!doubaoApiKey)
        setMaskedDoubaoKey(doubaoApiKey ? doubaoApiKey.slice(0, 4) + '****' + doubaoApiKey.slice(-4) : null)
        setDoubaoApiKey('')
      } else {
        setDoubaoMessage({ type: 'error', text: json.error || '保存失败' })
      }
    } catch {
      setDoubaoMessage({ type: 'error', text: '保存失败，请稍后重试' })
    } finally {
      setDoubaoSaving(false)
    }
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8 max-w-2xl">
      <motion.div variants={fadeUp}>
        <PageHeader title="设置" subtitle="个性化配置与账户管理" />
      </motion.div>

      {/* ──── 账户信息 ──── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-glass-sm bg-accent/20 text-accent">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">账户信息</h2>
              <p className="text-xs text-text-tertiary">查看账户详情与登录状态</p>
            </div>
          </div>

          {accountLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-text-tertiary">
              加载中…
            </div>
          ) : accountInfo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-glass-sm bg-surface-secondary px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">用户名</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{accountInfo.username}</p>
                </div>
                <div className="rounded-glass-sm bg-surface-secondary px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">显示名称</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{accountInfo.name}</p>
                </div>
                <div className="rounded-glass-sm bg-surface-secondary px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">账户角色</p>
                  <div className="mt-1">
                    <Badge variant={accountInfo.role === 'ADMIN' ? 'accent' : 'default'} size="sm">
                      <Shield className="mr-1 inline h-3 w-3" />
                      {accountInfo.roleLabel}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-glass-sm bg-surface-secondary px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">登录状态</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-success" />
                    <span className="text-sm font-semibold text-text-primary">已登录</span>
                  </div>
                </div>
                <div className="rounded-glass-sm bg-surface-secondary px-4 py-3 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    <Calendar className="mr-1 inline h-3 w-3" />
                    注册时间
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">
                    {new Date(accountInfo.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-text-tertiary">
              无法加载账户信息
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ──── 修改密码 ──── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-glass-sm bg-amber-500/20 text-amber-500">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">修改密码</h2>
              <p className="text-xs text-text-tertiary">定期更换密码有助于账户安全</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">当前密码</label>
              <Input
                type="password"
                placeholder="输入当前密码"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">新密码</label>
              <Input
                type="password"
                placeholder="至少 6 位字符"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">确认新密码</label>
              <Input
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                loading={passwordSaving}
                disabled={!currentPassword || !newPassword || !confirmPassword}
                onClick={handleChangePassword}
              >
                <Lock className="h-4 w-4" />
                修改密码
              </Button>
              {passwordMessage && (
                <span className={`text-sm ${passwordMessage.type === 'success' ? 'text-success' : 'text-danger'}`}>
                  {passwordMessage.type === 'success' && <Check className="mr-1 inline h-3.5 w-3.5" />}
                  {passwordMessage.text}
                </span>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ──── AI 配置 ──── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-glass-sm bg-accent/20 text-accent">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">AI 模型配置</h2>
              <p className="text-xs text-text-tertiary">自定义 DeepSeek API 密钥和模型</p>
            </div>
          </div>

          {aiLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-text-tertiary">
              加载中…
            </div>
          ) : (
            <div className="space-y-5">
              {/* API Key */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                  DeepSeek API Key
                </label>
                {hasApiKey && maskedKey && (
                  <p className="mb-2 text-xs text-text-tertiary">
                    当前密钥：<code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-accent">{maskedKey}</code>
                    {' '}（输入新值以替换）
                  </p>
                )}
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={hasApiKey ? '输入新 API Key 以替换…' : '输入你的 DeepSeek API Key'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-text-tertiary">
                  留空则使用服务器环境变量的默认密钥
                </p>
              </div>

              {/* 模型选择 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  模型选择
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {MODEL_OPTIONS.map((opt) => {
                    const isActive = selectedModel === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedModel(opt.value)}
                        className={`relative flex flex-col items-center gap-2 rounded-glass-sm border-2 px-4 py-4 transition-all duration-200 ${
                          isActive
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-surface-tertiary bg-surface text-text-secondary hover:border-text-tertiary hover:text-text-primary'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="model-dot"
                            className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent"
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        )}
                        <Cpu className="h-6 w-6" />
                        <span className="text-sm font-medium">{opt.label}</span>
                        <span className="text-xs text-current/60">{opt.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 保存 */}
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  loading={aiSaving}
                  onClick={saveAiSettings}
                >
                  <Save className="h-4 w-4" />
                  保存配置
                </Button>
                {aiMessage && (
                  <span className={`text-sm ${aiMessage.type === 'success' ? 'text-success' : 'text-danger'}`}>
                    {aiMessage.type === 'success' && <Check className="mr-1 inline h-3.5 w-3.5" />}
                    {aiMessage.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ──── Doubao OCR 配置 ──── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-glass-sm bg-purple-500/20 text-purple-500">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Doubao 视觉大模型配置</h2>
              <p className="text-xs text-text-tertiary">配置 Doubao-Seed-1.8-Vision API Key 用于高精度 OCR 识别</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* API Key */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Doubao API Key
              </label>
              {hasDoubaoApiKey && maskedDoubaoKey && (
                <p className="mb-2 text-xs text-text-tertiary">
                  当前密钥：<code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-purple-500">{maskedDoubaoKey}</code>
                  {" "}（输入新值以替换）
                </p>
              )}
              <div className="relative">
                <Input
                  type={showDoubaoKey ? "text" : "password"}
                  placeholder={hasDoubaoApiKey ? "输入新 Doubao API Key 以替换…" : "输入你的 Doubao API Key"}
                  value={doubaoApiKey}
                  onChange={(e) => setDoubaoApiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowDoubaoKey(!showDoubaoKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                >
                  {showDoubaoKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-text-tertiary">
                留空则使用服务器端 .env 环境变量的默认密钥。配置后可在试卷上传/答题卡识别/小分识别中使用。
              </p>
            </div>

            {/* 保存 */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                loading={doubaoSaving}
                onClick={saveDoubaoSettings}
              >
                <Save className="h-4 w-4" />
                保存配置
              </Button>
              {doubaoMessage && (
                <span className={"text-sm " + (doubaoMessage.type === "success" ? "text-success" : "text-danger")}>
                  {doubaoMessage.type === "success" && <Check className="mr-1 inline h-3.5 w-3.5" />}
                  {doubaoMessage.text}
                </span>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ──── 主题设置 ──── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-glass-sm bg-accent/20 text-accent">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">主题外观</h2>
              <p className="text-xs text-text-tertiary">选择你偏好的界面外观</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = theme === opt.value

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={[
                    'relative flex flex-col items-center gap-2 rounded-glass-sm border-2 px-4 py-5 transition-all duration-200',
                    isActive
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-surface-tertiary bg-surface text-text-secondary hover:border-text-tertiary hover:text-text-primary',
                  ].join(' ')}
                >
                  {isActive && (
                    <motion.div
                      layoutId="theme-dot"
                      className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon className="h-7 w-7" />
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-xs text-current/60">{opt.desc}</span>
                </button>
              )
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* ──── 退出登录 ──── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-glass-sm bg-danger/20 text-danger">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">退出登录</h2>
              <p className="text-xs text-text-tertiary">登出当前账户，返回登录页</p>
            </div>
          </div>

          <Button
            variant="danger"
            size="lg"
            className="w-full sm:w-auto"
            loading={loggingOut}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </GlassCard>
      </motion.div>

      {/* ──── 注销账号 ──── */}
      <motion.div variants={fadeUp}>
        <GlassCard gradient="none" className="p-6 border-danger/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-glass-sm bg-danger/20 text-danger">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">注销账号</h2>
              <p className="text-xs text-text-tertiary">永久删除账户及其所有关联数据</p>
            </div>
          </div>

          {deleteState === 'idle' && (
            <div className="space-y-3">
              <p className="text-sm text-text-tertiary leading-relaxed">
                注销后，你的账户数据将被永久删除，此操作<strong className="text-danger">不可撤销</strong>。
                与该账户关联的考试记录将保留在系统中，但不再归属于任何用户。
              </p>
              <Button
                variant="danger"
                size="lg"
                className="w-full sm:w-auto"
                onClick={startDeleteCountdown}
              >
                <Trash2 className="h-4 w-4" />
                注销账号
              </Button>
            </div>
          )}

          {deleteState === 'counting' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-glass-sm bg-danger/10 px-4 py-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">确认注销账号</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    请在倒计时结束后确认，或点击取消返回
                  </p>
                </div>
                <span className="text-2xl font-bold tabular-nums text-danger min-w-[3rem] text-center">
                  {countdown}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={cancelDelete}>
                <X className="h-4 w-4" />
                取消
              </Button>
            </div>
          )}

          {deleteState === 'confirming' && (
            <div className="space-y-4">
              <div className="rounded-glass-sm bg-danger/10 px-4 py-3">
                <p className="text-sm font-medium text-danger">
                  确定要注销账号吗？此操作不可撤销！
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  你的个人资料、账号信息将被永久删除。考试数据将保留在系统中。
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="danger" size="lg" loading={deleting} onClick={confirmDeleteAccount}>
                  <Trash2 className="h-4 w-4" />
                  确认注销
                </Button>
                <Button variant="secondary" size="lg" disabled={deleting} onClick={cancelDelete}>
                  取消
                </Button>
              </div>
            </div>
          )}

          {deleteError && (
            <p className="mt-3 text-sm text-danger">{deleteError}</p>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
