'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { GraduationCap, Eye, EyeOff, User, Shield } from 'lucide-react'
import { Button } from '@/components/ui-system/Button'
import { Input } from '@/components/ui-system/Input'
import { Spinner } from '@/components/ui-system/Spinner'
import { GlassCard } from '@/components/ui-system/GlassCard'

// ── Animation（与内部页面保持一致） ──

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

// ── Page ──

function LoginForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  // 角色标签 & 模式
  const [roleTab, setRoleTab] = useState<'user' | 'admin'>('user')
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // 表单字段
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 切换标签时重置
  function switchTab(tab: 'user' | 'admin') {
    setRoleTab(tab)
    setMode('login')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'register') {
        // ── 注册 ──
        if (!username.trim() || !name.trim() || !password.trim()) {
          setError('请填写所有字段')
          setLoading(false)
          return
        }
        if (username.trim().length < 3) {
          setError('用户名至少 3 个字符')
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError('密码至少 6 个字符')
          setLoading(false)
          return
        }
        if (password !== confirmPassword) {
          setError('两次密码输入不一致')
          setLoading(false)
          return
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            name: name.trim(),
            password,
          }),
        })
        const json = await res.json()
        if (!json.success) {
          setError(json.error || '注册失败')
          setLoading(false)
          return
        }

        // 注册成功 → 自动登录
        const signInResult = await signIn('credentials', {
          username: username.trim(),
          password,
          redirect: false,
        })

        if (signInResult?.error) {
          setError('注册成功但自动登录失败，请手动登录')
          setLoading(false)
          return
        }

        window.location.href = '/dashboard'
      } else {
        // ── 登录 ──
        const result = await signIn('credentials', {
          username,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError('用户名或密码错误')
          setLoading(false)
          return
        }

        // 获取会话以确定角色
        const sessionRes = await fetch('/api/auth/session')
        const session = await sessionRes.json()

        if (session?.user?.role === 'ADMIN') {
          window.location.href = '/admin'
        } else {
          window.location.href = callbackUrl
        }
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* ── 环境光晕 ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 -right-48 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-accent/[0.03] blur-3xl" />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full max-w-sm"
      >
        {/* ── Logo ── */}
        <motion.div variants={fadeUp} className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent/80 text-white shadow-glass-floating">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-text-primary">
            StarMap
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            智能学情分析平台
          </p>
        </motion.div>

        {/* ── GlassCard 表单 ── */}
        <motion.div variants={fadeUp}>
          <GlassCard gradient="none" className="p-8" hover={false}>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 角色标签切换 */}
              <div className="flex rounded-xl bg-surface-secondary p-1">
                <button
                  type="button"
                  onClick={() => switchTab('user')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    roleTab === 'user'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <User className="h-4 w-4" />
                  用户登录
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('admin')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    roleTab === 'admin'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  管理员登录
                </button>
              </div>

              <Input
                label="用户名"
                placeholder="输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoFocus
                required
              />

              {/* 注册模式：姓名 */}
              {mode === 'register' && (
                <Input
                  label="姓名"
                  placeholder="输入你的姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              )}

              {/* 密码 */}
              <div className="relative">
                <Input
                  label={mode === 'register' ? '设置密码' : '密码'}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? '至少 6 位密码' : '输入密码'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-text-tertiary hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* 注册模式：确认密码 */}
              {mode === 'register' && (
                <Input
                  label="确认密码"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-danger text-center"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
              >
                {mode === 'register' ? '注册' : '登录'}
              </Button>

              {/* 用户标签 + 登录模式 → 显示注册入口 */}
              {roleTab === 'user' && isLogin && (
                <p className="text-center text-sm text-text-tertiary">
                  没有账号？{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register')
                      setError(null)
                    }}
                    className="font-medium text-accent hover:underline"
                  >
                    立即注册
                  </button>
                </p>
              )}

              {/* 用户标签 + 注册模式 → 显示返回登录 */}
              {roleTab === 'user' && !isLogin && (
                <p className="text-center text-sm text-text-tertiary">
                  已有账号？{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setError(null)
                    }}
                    className="font-medium text-accent hover:underline"
                  >
                    返回登录
                  </button>
                </p>
              )}
            </form>
          </GlassCard>
        </motion.div>

        {/* ── 底部信息 ── */}
        <motion.p
          variants={fadeUp}
          className="mt-6 text-center text-xs text-text-tertiary/50"
        >
          StarMap · Made by HEAOZIE
        </motion.p>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" label="加载中…" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
