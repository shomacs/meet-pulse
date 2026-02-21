import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { meetings } from '../api'
import { useAuth } from '../context/AuthContext'

function MeetingCard({ meeting, isAdmin }) {
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const hidden = !meeting.is_visible
  return (
    <div className={`card p-5 hover:shadow-md transition-all duration-150 group ${hidden ? 'opacity-60 border-dashed hover:border-slate-300' : 'hover:border-indigo-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug">
              {meeting.title}
            </h3>
            {isAdmin && hidden && (
              <span className="badge bg-slate-100 text-slate-500 shrink-0 mt-0.5">Hidden</span>
            )}
          </div>
          {meeting.description && (
            <p className="text-sm text-slate-500 mt-1">{meeting.description}</p>
          )}
          <p className="text-xs text-slate-400 mt-2">{fmtDate(meeting.created_at)}</p>
        </div>
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${hidden ? 'bg-slate-100' : 'bg-indigo-50'}`}>
          <svg className={`w-5 h-5 ${hidden ? 'text-slate-400' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Link
          to={`/meetings/${meeting.id}/questions`}
          className="btn-primary btn-sm flex-1 justify-center"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Questions
        </Link>
        <Link
          to={`/meetings/${meeting.id}/pulse`}
          className="btn-secondary btn-sm flex-1 justify-center"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Live Pulse
        </Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [meetingList, setMeetingList] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    meetings.list().then(setMeetingList).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">Select a meeting to view questions or live pulse.</p>
        </div>
        {user?.is_admin && (
          <Link to="/admin" className="btn-secondary btn-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Admin panel
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        </div>
      ) : meetingList.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-700 text-lg">No meetings yet</h3>
          <p className="text-slate-500 text-sm mt-1">
            {user?.is_admin ? 'Create a meeting from the Admin panel.' : 'Ask an admin to create the first meeting.'}
          </p>
          {user?.is_admin && (
            <Link to="/admin" className="btn-primary mt-4 inline-flex">Go to Admin</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meetingList.map((m) => (
            <MeetingCard key={m.id} meeting={m} isAdmin={user?.is_admin} />
          ))}
        </div>
      )}
    </div>
  )
}
