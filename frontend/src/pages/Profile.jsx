import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { profile } from '../api'

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  )
}

export default function Profile() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    profile.get().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    )
  }

  const user = data?.user
  const userQuestions = data?.questions || []
  const letter = (user?.name || user?.email || '?')[0].toUpperCase()

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">My Profile</h1>

      {/* Profile card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-bold shrink-0">
            {letter}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{user?.name || '—'}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              {user?.is_admin && (
                <span className="badge bg-indigo-100 text-indigo-700">Admin</span>
              )}
              <span className={`badge ${user?.is_approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {user?.is_approved ? 'Approved' : 'Pending approval'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-100">
          <InfoRow label="Phone" value={user?.phone} />
          <InfoRow label="Email" value={user?.email} />
          {user?.bio && <div className="col-span-2 sm:col-span-3"><InfoRow label="About" value={user?.bio} /></div>}
        </div>
      </div>

      {/* Questions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          My Questions
          <span className="ml-2 text-sm font-normal text-slate-500">({userQuestions.length})</span>
        </h2>

        {userQuestions.length === 0 ? (
          <div className="card p-8 text-center">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-500 text-sm">You haven't added any questions yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userQuestions.map((q) => (
              <div key={q.id} className="card p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 leading-relaxed">{q.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {q.meeting_id ? (
                      <Link
                        to={`/meetings/${q.meeting_id}/questions`}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {q.meeting_title || `Meeting ${q.meeting_id}`}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">No meeting</span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
