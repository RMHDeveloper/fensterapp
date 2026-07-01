import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function LoginScreen() {
  const { loginWithCredentials } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim())    { setError('Please enter your email.'); return }
    if (!password)        { setError('Please enter your password.'); return }
    setLoading(true)
    setTimeout(() => {
      const result = loginWithCredentials(email.trim(), password)
      if (!result.success) {
        setError(result.error ?? 'Invalid email or password.')
        setLoading(false)
        return
      }
      navigate('/home', { replace: true })
    }, 300)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-14 pb-10 text-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #065F2D 0%, #0B7A3B 60%, #1a9e50 100%)' }}>
        <div className="flex items-center justify-center mb-5">
          <img
            src="/brand/fenster-logo.png"
            alt="Fenster Ecotech"
            className="object-contain"
            style={{ height: 64, maxWidth: 240 }}
          />
        </div>
        <p className="text-green-200 text-sm mt-1">Operations Workflow</p>
      </div>

      {/* Form */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-5 px-5 pt-8 pb-10">
        <h2 className="text-xl font-extrabold text-slate-800 mb-1">Welcome back</h2>
        <p className="text-sm text-slate-500 mb-6">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Email</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <Mail size={16} className="text-slate-400" />
              </div>
              <input
                type="email" inputMode="email" autoComplete="email" autoFocus
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="your@email.com"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Password</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock size={16} className="text-slate-400" />
              </div>
              <input
                type={showPass ? 'text' : 'password'} autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Enter your password"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-10 pr-12 py-3.5 text-sm focus:outline-none focus:border-green-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 active:text-slate-600">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-red-600">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center text-[#065F2D] rounded-xl font-bold text-base min-h-[52px] transition-colors mt-1 disabled:opacity-70 active:opacity-90"
            style={{ background: '#9DCD3A' }}>
            {loading
              ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : 'Login to Fenster OS'}
          </button>
        </form>
      </div>
    </div>
  )
}
