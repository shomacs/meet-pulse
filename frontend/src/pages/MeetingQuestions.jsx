import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { questions as questionsApi, meetings, admin as adminApi } from '../api'
import { useAuth } from '../context/AuthContext'

function VoteButton({ count, active, loading, onClick, direction, voters, disabled }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const icon = direction === 'up'
    ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />

  return (
    <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border disabled:opacity-60 disabled:cursor-not-allowed ${
          active
            ? direction === 'up'
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        {loading
          ? <span className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
          : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>{icon}</svg>
        }
        <span>{count}</span>
      </button>

      {/* Tooltip */}
      {showTooltip && voters.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
          <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 max-w-[200px] text-center shadow-lg">
            <p className="font-medium mb-1 text-slate-300">{direction === 'up' ? 'Upvoted by' : 'Downvoted by'}</p>
            {voters.slice(0, 8).map((v, i) => <p key={i} className="truncate">{v}</p>)}
            {voters.length > 8 && <p className="text-slate-400">+{voters.length - 8} more</p>}
          </div>
          <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  )
}

function QuestionCard({ q, onVote, votingId, isAdmin, onDelete }) {
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const { user } = useAuth()
  const isOwn = user?.id === q.author_id
  const isVoting = votingId === q.id

  return (
    <div className="card p-4 sm:p-5 hover:shadow-md transition-all duration-150">
      <div className="flex gap-4">
        {/* Score */}
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <VoteButton
            count={q.up_count} active={q.my_vote === 'up'} direction="up"
            voters={q.up_voters} loading={isVoting && q.my_vote !== 'up'}
            disabled={isOwn} onClick={() => onVote(q.id, 'up')}
          />
          <span className={`text-sm font-bold tabular-nums ${q.score > 0 ? 'text-indigo-600' : q.score < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {q.score > 0 ? `+${q.score}` : q.score}
          </span>
          <VoteButton
            count={q.down_count} active={q.my_vote === 'down'} direction="down"
            voters={q.down_voters} loading={isVoting && q.my_vote !== 'down'}
            disabled={isOwn} onClick={() => onVote(q.id, 'down')}
          />
          {isOwn && <span className="text-[10px] text-slate-400 text-center leading-tight">your<br/>question</span>}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 text-sm sm:text-base leading-relaxed">{q.text}</p>
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {q.author}
            </span>
            <span>{fmtDate(q.created_at)}</span>
          </div>
        </div>

        {/* Delete (admin) */}
        {isAdmin && (
          <button
            onClick={() => onDelete(q.id)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete question"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function MeetingQuestions() {
  const { id } = useParams()
  const { user } = useAuth()
  const [questionList, setQuestionList] = useState([])
  const [meetingTitle, setMeetingTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [votingId, setVotingId] = useState(null)  // question id being voted on
  const textareaRef = useRef(null)

  const load = async (silent = false) => {
    try {
      // Only fetch meeting title once (it doesn't change)
      const qs = await questionsApi.list(id)
      if (!silent && !meetingTitle) {
        const ms = await meetings.list()
        const m = ms.find((m) => String(m.id) === String(id))
        if (m) setMeetingTitle(m.title)
      }
      setQuestionList([...qs].sort((a, b) => b.score - a.score))
    } catch (err) {
      console.error(err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const addQuestion = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setError('')
    setSubmitting(true)
    try {
      await questionsApi.add(id, { text: text.trim() })
      setText('')
      await load(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (qid, voteType) => {
    if (votingId) return
    setVotingId(qid)
    try {
      await questionsApi.vote(qid, voteType)
      await load(true)
    } catch (err) {
      console.error(err)
    } finally {
      setVotingId(null)
    }
  }

  const handleDelete = async (qid) => {
    if (!confirm('Delete this question?')) return
    try {
      await adminApi.deleteQuestion(qid)
      setQuestionList((prev) => prev.filter((q) => q.id !== qid))
    } catch (err) {
      console.error(err)
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
        <span className="text-slate-900 font-medium truncate max-w-[200px]">{meetingTitle || `Meeting ${id}`}</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{meetingTitle || 'Questions'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{questionList.length} question{questionList.length !== 1 ? 's' : ''} · sorted by votes</p>
        </div>
        <Link to={`/meetings/${id}/pulse`} className="btn-secondary btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Live Pulse
        </Link>
      </div>

      {/* Add question */}
      <form onSubmit={addQuestion} className="card p-4 mb-6">
        <label className="label">Add a question</label>
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            className="input flex-1 resize-none"
            rows={2}
            placeholder="Type your question…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addQuestion(e) }
            }}
          />
          <button type="submit" className="btn-primary self-end" disabled={submitting || !text.trim()}>
            {submitting ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </form>

      {/* Questions list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        </div>
      ) : questionList.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-700">No questions yet</h3>
          <p className="text-slate-500 text-sm mt-1">Be the first to ask something.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questionList.map((q) => (
            <QuestionCard key={q.id} q={q} onVote={handleVote} votingId={votingId} isAdmin={user?.is_admin} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
