import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { pulse as pulseApi, meetings } from '../api'

function PulseOption({ option, onVote, totalVotes }) {
  return (
    <button
      onClick={() => onVote(option.id)}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-150 group ${
        option.my_vote
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${option.my_vote ? 'text-indigo-700' : 'text-slate-700'}`}>
          {option.text}
        </span>
        <div className="flex items-center gap-2">
          {option.my_vote && (
            <span className="badge bg-indigo-100 text-indigo-700">Your vote</span>
          )}
          <span className="text-sm font-semibold text-slate-600">{option.pct}%</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${option.my_vote ? 'bg-indigo-500' : 'bg-slate-300 group-hover:bg-indigo-300'}`}
          style={{ width: `${option.pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1.5">{option.votes} vote{option.votes !== 1 ? 's' : ''}</p>
    </button>
  )
}

export default function MeetingPulse() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [p, ms] = await Promise.all([pulseApi.get(id), meetings.list()])
      const m = ms.find((m) => String(m.id) === String(id))
      if (m) setMeetingTitle(m.title)
      setData(p)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [load])

  const handleVote = async (optionId) => {
    if (voting) return
    setVoting(true)
    try {
      await pulseApi.vote(optionId)
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setVoting(false)
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/" className="hover:text-slate-700">Dashboard</Link>
        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <Link to={`/meetings/${id}/questions`} className="hover:text-slate-700 truncate max-w-[150px]">
          {meetingTitle || `Meeting ${id}`}
        </Link>
        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-900 font-medium">Live Pulse</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Live Pulse</h1>
            {data?.active && (
              <span className="flex items-center gap-1 badge bg-rose-100 text-rose-600 px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Real-time feedback for {meetingTitle || 'this meeting'}</p>
        </div>
        <Link to={`/meetings/${id}/questions`} className="btn-secondary btn-sm">
          Questions
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        </div>
      ) : !data?.active ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-700 text-lg">No active pulse</h3>
          <p className="text-slate-500 text-sm mt-1">An admin will start a live pulse during the meeting.</p>
          <p className="text-slate-400 text-xs mt-3">This page auto-refreshes every 5 seconds.</p>
        </div>
      ) : (
        <div className="max-w-xl mx-auto">
          <div className="card p-6 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-medium text-rose-600 uppercase tracking-wide">Live poll</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-5">{data.title}</h2>

            <div className="space-y-3">
              {data.options.map((opt) => (
                <PulseOption key={opt.id} option={opt} onVote={handleVote} totalVotes={data.total_votes} />
              ))}
            </div>

            <p className="text-center text-xs text-slate-400 mt-5">
              {data.total_votes} total vote{data.total_votes !== 1 ? 's' : ''} · updates every 5s
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
