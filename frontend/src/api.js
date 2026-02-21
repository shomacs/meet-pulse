const BASE = '/api'

async function req(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error || data?.detail || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

const get = (path) => req('GET', path)
const post = (path, body) => req('POST', path, body)
const del = (path) => req('DELETE', path)

export const auth = {
  me: () => get('/me'),
  signup: (body) => post('/auth/signup', body),
  signupVerify: (body) => post('/auth/signup/verify', body),
  login: (body) => post('/auth/login', body),
  loginVerify: (body) => post('/auth/login/verify', body),
  logout: () => post('/auth/logout'),
}

export const meetings = {
  list: () => get('/meetings'),
  create: (body) => post('/meetings', body),
}

export const questions = {
  list: (meetingId) => get(`/meetings/${meetingId}/questions`),
  add: (meetingId, body) => post(`/meetings/${meetingId}/questions`, body),
  vote: (questionId, voteType) => post(`/questions/${questionId}/vote`, { vote_type: voteType }),
}

export const pulse = {
  get: (meetingId) => get(`/meetings/${meetingId}/pulse`),
  vote: (optionId) => post(`/pulse/options/${optionId}/vote`),
}

export const profile = {
  get: () => get('/profile'),
}

export const admin = {
  users: () => get('/admin/users'),
  approve: (userId) => post(`/admin/users/${userId}/approve`),
  toggleAdmin: (userId) => post(`/admin/users/${userId}/toggle-admin`),
  deleteUser: (userId) => del(`/admin/users/${userId}`),
  questions: (meetingId) => get(`/admin/questions${meetingId ? `?meeting_id=${meetingId}` : ''}`),
  deleteQuestion: (id) => del(`/admin/questions/${id}`),
  meetings: () => get('/admin/meetings'),
  createMeeting: (body) => post('/meetings', body),
  toggleMeetingVisibility: (id) => post(`/admin/meetings/${id}/toggle-visibility`),
  getPulse: (meetingId) => get(`/admin/pulse${meetingId ? `?meeting_id=${meetingId}` : ''}`),
  startPulse: (body) => post('/admin/pulse', body),
  endPulse: (id) => post(`/admin/pulse/${id}/end`),
  meetingQuestionsForPulse: (meetingId) => get(`/admin/meeting-questions/${meetingId}`),
}
