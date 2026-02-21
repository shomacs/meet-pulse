import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { auth } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const [step, setStep] = useState('info') // 'info' | 'code' | 'pending'
  const [form, setForm] = useState({ name: '', email: '', phone: '', bio: '' })
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.signup(form)
      setStep('code')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await auth.signupVerify({ email: form.email, code })
      if (res.step === 'pending_approval') {
        setStep('pending')
      } else {
        await refresh()
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
          <p className="text-sm text-slate-500 mt-1">Join SHOMACS MeetPulse</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {['info', 'code'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold border-2 transition-colors ${
                step === s ? 'border-indigo-600 bg-indigo-600 text-white' :
                (i < ['info','code'].indexOf(step) ? 'border-indigo-600 bg-white text-indigo-600' : 'border-slate-200 bg-white text-slate-400')
              }`}>{i + 1}</div>
              {i === 0 && <div className={`h-0.5 w-8 rounded ${step === 'code' ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <div className="card p-6 shadow-xl shadow-slate-200/60">
          {step === 'info' && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" type="text" placeholder="John Smith" value={form.name} onChange={change('name')} autoFocus />
              </div>
              <div>
                <label className="label">Email address <span className="text-red-500">*</span></label>
                <input className="input" type="email" required placeholder="you@example.com" value={form.email} onChange={change('email')} />
              </div>
              <div>
                <label className="label">Phone number</label>
                <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={change('phone')} />
              </div>
              <div>
                <label className="label">About you</label>
                <textarea className="input resize-none" rows={2} placeholder="Brief introduction…" value={form.bio} onChange={change('bio')} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Sending…
                  </span>
                ) : 'Continue'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={verify} className="space-y-4">
              <div className="text-center pb-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700 font-medium">Check your email</p>
                <p className="text-xs text-slate-500 mt-0.5">Code sent to <span className="font-medium">{form.email}</span></p>
              </div>
              <div>
                <label className="label">Verification code</label>
                <input
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  className="input text-center text-xl tracking-widest font-mono"
                  placeholder="• • • • • •"
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Verifying…
                  </span>
                ) : 'Verify email'}
              </button>
              <button type="button" onClick={() => { setStep('info'); setCode(''); setError('') }} className="btn-ghost w-full text-sm">
                Back
              </button>
            </form>
          )}

          {step === 'pending' && (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100">
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Account pending approval</h3>
                <p className="text-sm text-slate-500 mt-1">Your email is verified. An admin will approve your account shortly.</p>
              </div>
              <Link to="/login" className="btn-secondary block">Back to login</Link>
            </div>
          )}
        </div>

        {step !== 'pending' && (
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700">Sign in</Link>
          </p>
        )}
      </div>
    </div>
  )
}
