import { useEffect, useState, useCallback } from 'react'
import { admin } from '../api'
import { useAuth } from '../context/AuthContext'

// ─── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ['Users', 'Meetings', 'Questions', 'Pulse']

function Tab({ label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
      }`}
    >
      {label}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionUser, setActionUser] = useState(null) // userId currently being acted on
  const [toast, setToast] = useState('')
  const { user: currentUser } = useAuth()

  const load = () => admin.users().then(setData).catch(console.error).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const [toastType, setToastType] = useState('ok')
  const showToast = (msg, type = 'ok') => { setToast(msg); setToastType(type); setTimeout(() => setToast(''), 3500) }

  const approve = async (userId) => {
    setActionUser(userId + '-approve')
    try {
      await admin.approve(userId)
      showToast('User approved.')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActionUser(null)
    }
  }

  const toggleAdmin = async (u) => {
    const action = u.is_admin ? 'Remove admin access from' : 'Grant admin access to'
    if (!confirm(`${action} ${u.name || u.email}?`)) return
    setActionUser(u.id + '-admin')
    try {
      await admin.toggleAdmin(u.id)
      showToast(u.is_admin ? 'Admin access removed.' : 'Admin access granted.')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActionUser(null)
    }
  }

  const deleteUser = async (u) => {
    if (!confirm(`Delete ${u.name || u.email}?\n\nThis will also delete all their questions and votes. This cannot be undone.`)) return
    setActionUser(u.id + '-delete')
    try {
      await admin.deleteUser(u.id)
      showToast('User deleted.')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActionUser(null)
    }
  }

  if (loading) return <Loader />

  const pending = data?.users?.filter((u) => !u.is_approved) || []
  const approved = data?.users?.filter((u) => u.is_approved) || []

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`rounded-lg text-white text-sm px-4 py-2.5 flex items-center gap-2 w-fit ${toastType === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
          {toastType === 'error'
            ? <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            : <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          }
          {toast}
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-semibold text-amber-800">{pending.length} pending approval{pending.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-xs text-amber-700">Review and approve new sign-ups below.</p>
        </div>
      )}

      {[{ title: 'Pending Approval', users: pending }, { title: 'Active Users', users: approved }].map(({ title, users }) => (
        users.length > 0 && (
          <div key={title}>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {title} <span className="text-slate-400 font-normal">({users.length})</span>
            </h3>
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${u.is_admin ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                      {(u.name || u.email)[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 truncate">{u.name || '—'}</p>
                        {isSelf && <span className="badge bg-slate-100 text-slate-500">You</span>}
                        {u.is_admin && <span className="badge bg-indigo-100 text-indigo-700">Admin</span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                      {u.meetings?.length > 0 && (
                        <p className="text-xs text-indigo-600 mt-0.5 truncate">
                          Questions in: {u.meetings.join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!u.is_approved ? (
                        <button
                          onClick={() => approve(u.id)}
                          disabled={actionUser === u.id + '-approve'}
                          className="btn-primary btn-sm"
                        >
                          {actionUser === u.id + '-approve'
                            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            : 'Approve'}
                        </button>
                      ) : (
                        <span className="badge bg-green-100 text-green-700">Approved</span>
                      )}

                      {/* Admin toggle — hidden for self */}
                      {!isSelf && u.is_approved && (
                        <button
                          onClick={() => toggleAdmin(u)}
                          disabled={actionUser === u.id + '-admin'}
                          title={u.is_admin ? 'Remove admin access' : 'Grant admin access'}
                          className={`btn-sm border transition-colors ${
                            u.is_admin
                              ? 'border-indigo-200 text-indigo-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                              : 'border-slate-200 text-slate-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                          }`}
                        >
                          {actionUser === u.id + '-admin' ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                          ) : u.is_admin ? (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              Admin
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Make admin
                            </span>
                          )}
                        </button>
                      )}

                      {/* Delete — hidden for self */}
                      {!isSelf && (
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={!!actionUser}
                          title="Delete user"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {actionUser === u.id + '-delete' ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-red-500 animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ))}
    </div>
  )
}

// ─── Meetings Tab ──────────────────────────────────────────────────────────────
function MeetingsTab() {
  const [meetingList, setMeetingList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '' })
  const [creating, setCreating] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const [error, setError] = useState('')

  const load = () => admin.meetings().then(setMeetingList).catch(console.error).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const toggleVisibility = async (m) => {
    setTogglingId(m.id)
    try {
      await admin.toggleMeetingVisibility(m.id)
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setTogglingId(null)
    }
  }

  const create = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setError('')
    setCreating(true)
    try {
      await admin.createMeeting({ title: form.title.trim(), description: form.description.trim() })
      setForm({ title: '', description: '' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Create new meeting</h3>
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="label">Meeting title <span className="text-red-500">*</span></label>
            <input className="input" type="text" placeholder="e.g. Q1 2026 General Meeting" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Optional description…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary" disabled={creating || !form.title.trim()}>
            {creating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Creating…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Create Meeting
              </span>
            )}
          </button>
        </form>
      </div>

      {/* List */}
      {loading ? <Loader /> : (
        meetingList.length === 0 ? (
          <EmptyState icon="calendar" text="No meetings yet. Create one above." />
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">All Meetings <span className="text-slate-400 font-normal">({meetingList.length})</span></h3>
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {meetingList.map((m) => (
                <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${!m.is_visible ? 'opacity-60' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.is_visible ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                    <svg className={`w-4 h-4 ${m.is_visible ? 'text-indigo-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 leading-snug">{m.title}</p>
                    {m.description && <p className="text-xs text-slate-500 truncate">{m.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!m.is_visible && <span className="badge bg-slate-100 text-slate-500">Hidden</span>}
                    <button
                      onClick={() => toggleVisibility(m)}
                      disabled={togglingId === m.id}
                      title={m.is_visible ? 'Hide from users' : 'Show to users'}
                      className={`flex items-center gap-1.5 btn-sm border transition-colors ${
                        m.is_visible
                          ? 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                          : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                      }`}
                    >
                      {togglingId === m.id ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                      ) : m.is_visible ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                          Hide
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Show
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ─── Questions Tab ─────────────────────────────────────────────────────────────
function QuestionsTab() {
  const [meetingList, setMeetingList] = useState([])
  const [selectedMeeting, setSelectedMeeting] = useState('')
  const [questionList, setQuestionList] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    admin.meetings().then(setMeetingList).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    admin.questions(selectedMeeting || null)
      .then(setQuestionList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedMeeting])

  const deleteQ = async (id) => {
    if (!confirm('Delete this question?')) return
    setDeleting(id)
    try {
      await admin.deleteQuestion(id)
      setQuestionList((prev) => prev.filter((q) => q.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700 shrink-0">Filter by meeting:</label>
        <select
          className="input flex-1 max-w-xs"
          value={selectedMeeting}
          onChange={(e) => setSelectedMeeting(e.target.value)}
        >
          <option value="">All meetings</option>
          {meetingList.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </div>

      {loading ? <Loader /> : questionList.length === 0 ? (
        <EmptyState icon="question" text="No questions found." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Question</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide w-12 text-center">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Author</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide hidden sm:table-cell">Meeting</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questionList.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="text-slate-900 line-clamp-2">{q.text}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold tabular-nums ${q.score > 0 ? 'text-indigo-600' : q.score < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {q.score > 0 ? `+${q.score}` : q.score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{q.author}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{q.meeting || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteQ(q.id)}
                        disabled={deleting === q.id}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {deleting === q.id ? (
                          <span className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin block" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pulse Tab ─────────────────────────────────────────────────────────────────
const DEFAULT_OPTIONS_GENERAL = ['Great', 'Good', 'Okay', 'Could be better']
const DEFAULT_OPTIONS_QUESTION = ['Yes', 'No', 'Abstain']

function OptionsBuilder({ options, onChange }) {
  const update = (i, val) => { const o = [...options]; o[i] = val; onChange(o) }
  const remove = (i) => { const o = options.filter((_, idx) => idx !== i); onChange(o) }
  const add = () => onChange([...options, ''])

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-medium shrink-0">
            {i + 1}
          </span>
          <input
            className="input flex-1"
            type="text"
            placeholder={`Option ${i + 1}`}
            value={opt}
            onChange={(e) => update(i, e.target.value)}
          />
          {options.length > 2 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      {options.length < 8 && (
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1 px-1 py-0.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add option
        </button>
      )}
    </div>
  )
}

function PulseTab() {
  const [meetingList, setMeetingList] = useState([])
  const [selectedMeeting, setSelectedMeeting] = useState('')
  const [meetingQuestions, setMeetingQuestions] = useState([])
  const [selectedQuestion, setSelectedQuestion] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [options, setOptions] = useState(DEFAULT_OPTIONS_GENERAL)
  const [activePoll, setActivePoll] = useState(null)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    admin.meetings().then((ms) => {
      setMeetingList(ms)
      if (ms.length > 0) setSelectedMeeting(String(ms[0].id))
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (!selectedMeeting) return
    admin.getPulse(selectedMeeting).then(setActivePoll).catch(console.error)
    admin.meetingQuestionsForPulse(selectedMeeting).then(setMeetingQuestions).catch(console.error)
    setSelectedQuestion('')
    setOptions(DEFAULT_OPTIONS_GENERAL)
  }, [selectedMeeting])

  // When question selection changes, pre-fill appropriate defaults
  const handleQuestionChange = (val) => {
    setSelectedQuestion(val)
    setOptions(val ? [...DEFAULT_OPTIONS_QUESTION] : [...DEFAULT_OPTIONS_GENERAL])
  }

  const startPulse = async (e) => {
    e.preventDefault()
    if (!selectedMeeting) { setError('Select a meeting first'); return }
    const validOptions = options.filter((o) => o.trim())
    if (validOptions.length < 2) { setError('Add at least 2 options'); return }
    setError('')
    setStarting(true)
    try {
      await admin.startPulse({
        meeting_id: parseInt(selectedMeeting),
        question_id: selectedQuestion ? parseInt(selectedQuestion) : null,
        title: customTitle.trim() || '',
        options: validOptions,
      })
      await admin.getPulse(selectedMeeting).then(setActivePoll)
      setCustomTitle('')
      setSelectedQuestion('')
      setOptions(DEFAULT_OPTIONS_GENERAL)
    } catch (err) {
      setError(err.message)
    } finally {
      setStarting(false)
    }
  }

  const endPulse = async () => {
    if (!activePoll?.id) return
    setEnding(true)
    try {
      await admin.endPulse(activePoll.id)
      setActivePoll({ active: false })
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Meeting selector */}
      <div>
        <label className="label">Meeting</label>
        <select
          className="input max-w-xs"
          value={selectedMeeting}
          onChange={(e) => setSelectedMeeting(e.target.value)}
        >
          <option value="">Select meeting…</option>
          {meetingList.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      </div>

      {/* Active poll */}
      {activePoll?.active && (
        <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Live Now</span>
              </div>
              <h3 className="font-semibold text-slate-900">{activePoll.title}</h3>
              {activePoll.meeting && <p className="text-xs text-slate-500 mt-0.5">{activePoll.meeting}</p>}
            </div>
            <button onClick={endPulse} disabled={ending} className="btn-danger btn-sm shrink-0">
              {ending ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : 'End Pulse'}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {activePoll.options?.map((o) => (
              <div key={o.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-rose-100">
                <span className="text-sm text-slate-700">{o.text}</span>
                <span className="text-sm font-semibold text-slate-900 tabular-nums">{o.votes} vote{o.votes !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start form */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          {activePoll?.active ? 'Start a new pulse (replaces current)' : 'Start a live pulse'}
        </h3>
        <form onSubmit={startPulse} className="space-y-5">

          {/* Pin a question */}
          <div>
            <label className="label">Pin a question (optional)</label>
            <select
              className="input"
              value={selectedQuestion}
              onChange={(e) => handleQuestionChange(e.target.value)}
              disabled={!selectedMeeting}
            >
              <option value="">General pulse — no specific question</option>
              {meetingQuestions.map((q) => (
                <option key={q.id} value={q.id}>{q.text}</option>
              ))}
            </select>
          </div>

          {/* Poll title (only shown for general pulse) */}
          {!selectedQuestion && (
            <div>
              <label className="label">Poll title</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. How is the session going?"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>
          )}

          {/* Options builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Options</label>
              <button
                type="button"
                onClick={() => setOptions(selectedQuestion ? [...DEFAULT_OPTIONS_QUESTION] : [...DEFAULT_OPTIONS_GENERAL])}
                className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
              >
                Reset to defaults
              </button>
            </div>
            <OptionsBuilder options={options} onChange={setOptions} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" className="btn-primary" disabled={starting || !selectedMeeting}>
            {starting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Starting…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Pulse
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  )
}

function EmptyState({ icon, text }) {
  const icons = {
    calendar: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
    question: <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  }
  return (
    <div className="text-center py-16">
      <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {icons[icon]}
      </svg>
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  )
}

// ─── Admin Page ────────────────────────────────────────────────────────────────
export default function Admin() {
  const [activeTab, setActiveTab] = useState('Users')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    admin.users().then((d) => setPendingCount(d.pending_count || 0)).catch(() => {})
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage users, meetings, questions, and live polls.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Tab
            key={t}
            label={t}
            active={activeTab === t}
            onClick={() => setActiveTab(t)}
            badge={t === 'Users' ? pendingCount : 0}
          />
        ))}
      </div>

      {activeTab === 'Users' && <UsersTab />}
      {activeTab === 'Meetings' && <MeetingsTab />}
      {activeTab === 'Questions' && <QuestionsTab />}
      {activeTab === 'Pulse' && <PulseTab />}
    </div>
  )
}
