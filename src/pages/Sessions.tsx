import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, Plus, Video, MapPin, Clock, User,
  CheckCircle2, ChevronDown, ChevronRight,
  Pencil, Save, X, LogIn, Star, Shield, Share2, Send, Video as VideoIcon
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Input, Select, TextArea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { toast } from '@/components/ui/Toast';
import type { SessionWithDetails, SessionDay, RequestWithDetails, SessionInvitationData } from '@/types';

const MEETING_URL = 'https://meet.google.com/home?authuser=0';

interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  ended_at: string | null;
  created_at: string;
}

interface FullSession extends SessionWithDetails {
  session_participants: SessionParticipant[];
}

export default function Sessions() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<FullSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'today' | 'past'>('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [acceptedRequests, setAcceptedRequests] = useState<RequestWithDetails[]>([]);
  const [form, setForm] = useState({ request_id: '', session_date: '', session_time: '', mode: 'Online', meeting_link: '' });
  const [saving, setSaving] = useState(false);

  // Admin edit state
  const [editingSession, setEditingSession] = useState<FullSession | null>(null);
  const [editForm, setEditForm] = useState({ session_date: '', session_time: '', mode: 'Online', meeting_link: '', status: 'Scheduled' });
  const [savingEdit, setSavingEdit] = useState(false);

  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionDays, setSessionDays] = useState<SessionDay[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [dayForm, setDayForm] = useState({ topics_text: '', notes: '' });
  const [savingDay, setSavingDay] = useState(false);

  const [endSessionTarget, setEndSessionTarget] = useState<FullSession | null>(null);
  const [endSessionDay, setEndSessionDay] = useState<SessionDay | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState<FullSession | null>(null);
  const [feedbackDay, setFeedbackDay] = useState<SessionDay | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(false);

  // Session share state
  const [shareTarget, setShareTarget] = useState<FullSession | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadSessions = useCallback(async () => {
    if (!profile) return;
    let query = supabase
      .from('sessions')
      .select(`
        *,
        skills:skill_id(name),
        mentor_profile:profiles!sessions_mentor_id_fkey(full_name),
        learner_profile:profiles!sessions_learner_id_fkey(full_name),
        session_participants(id, session_id, user_id, ended_at)
      `);
    if (isAdmin) {
      // Admin sees all sessions
    } else {
      query = query.or(`mentor_id.eq.${profile.id},learner_id.eq.${profile.id}`);
    }
    const { data } = await query.order('session_date', { ascending: false });
    setSessions((data as FullSession[]) ?? []);
    setLoading(false);
  }, [profile, isAdmin]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadSessionDays = useCallback(async (sessionId: string) => {
    setLoadingDays(true);
    const { data } = await supabase
      .from('session_days')
      .select('*')
      .eq('session_id', sessionId)
      .order('day_number', { ascending: true });
    setSessionDays((data as SessionDay[]) ?? []);
    setLoadingDays(false);
  }, []);

  async function toggleExpand(sessionId: string) {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(sessionId);
    setEditingDayId(null);
    await loadSessionDays(sessionId);
  }

  async function openScheduleModal() {
    if (!profile) return;
    const { data } = await supabase
      .from('skill_requests')
      .select(`
        *,
        skills:skill_id(name, category),
        requester_profile:profiles!skill_requests_requester_id_fkey(full_name, department),
        receiver_profile:profiles!skill_requests_receiver_id_fkey(full_name, department)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });
    setAcceptedRequests((data as RequestWithDetails[]) ?? []);
    setForm({ request_id: '', session_date: '', session_time: '', mode: 'Online', meeting_link: '' });
    setModalOpen(true);
  }

  function handleJoinMeeting() {
    window.open(MEETING_URL, '_blank', 'noopener,noreferrer');
  }

  function handleShareSession(s: FullSession) {
    if (!s.learner_id) {
      toast('error', 'No learner associated with this session');
      return;
    }
    setShareTarget(s);
  }

  async function handleShareToChat(s: FullSession) {
    if (!profile) return;
    if (!s.meeting_link) {
      toast('error', 'Meeting URL is missing for this session');
      return;
    }

    const invitation: SessionInvitationData = {
      skill_name: s.skills?.name ?? 'Learning Session',
      session_date: s.session_date,
      session_time: s.session_time,
      meeting_url: s.meeting_link,
      learner_name: s.learner_profile?.full_name ?? 'Learner',
    };

    setShareTarget(null);
    navigate('/chat', { state: { shareTargetUserId: s.learner_id, shareInvitation: invitation } });
  }

  async function handleSchedule() {
    if (!form.request_id || !form.session_date || !form.session_time) {
      toast('error', 'Please fill in all required fields');
      return;
    }
    if (form.session_date < todayStr) {
      toast('error', 'Cannot schedule a session in the past');
      return;
    }

    const req = acceptedRequests.find((r) => r.id === form.request_id);
    if (!req || !profile) return;

    const mentorId = req.receiver_id;
    const learnerId = req.requester_id;

    setSaving(true);
    const { error } = await supabase.from('sessions').insert({
      request_id: req.id,
      skill_id: req.skill_id,
      mentor_id: mentorId,
      learner_id: learnerId,
      session_date: form.session_date,
      session_time: form.session_time,
      mode: form.mode,
      meeting_link: form.mode === 'Online' ? MEETING_URL : '',
      status: 'Scheduled',
    });

    if (error) {
      toast('error', 'Failed to schedule session');
    } else {
      toast('success', 'Session scheduled successfully');
      setModalOpen(false);
      loadSessions();
    }
    setSaving(false);
  }

  // Admin edit session
  function openEditModal(s: FullSession) {
    setEditingSession(s);
    setEditForm({
      session_date: s.session_date,
      session_time: s.session_time,
      mode: s.mode,
      meeting_link: s.meeting_link || '',
      status: s.status,
    });
  }

  async function handleSaveEdit() {
    if (!editingSession) return;
    setSavingEdit(true);
    const update: Record<string, string> = {
      session_date: editForm.session_date,
      session_time: editForm.session_time,
      mode: editForm.mode,
      status: editForm.status,
    };
    if (editForm.mode === 'Online') {
      update.meeting_link = MEETING_URL;
    } else {
      update.meeting_link = '';
    }

    const { error } = await supabase.from('sessions').update(update).eq('id', editingSession.id);
    if (error) {
      toast('error', 'Failed to update session');
    } else {
      toast('success', 'Session updated successfully');
      setEditingSession(null);
      loadSessions();
    }
    setSavingEdit(false);
  }

  async function updateSessionStatus(id: string, status: string) {
    const { error } = await supabase.from('sessions').update({ status }).eq('id', id);
    if (error) toast('error', 'Failed to update session');
    else { toast('success', `Session marked as ${status}`); loadSessions(); }
  }

  // Day-wise learning
  async function addDay(sessionId: string) {
    const nextDay = sessionDays.length + 1;
    setSavingDay(true);
    const { data, error } = await supabase.from('session_days').insert({
      session_id: sessionId,
      day_number: nextDay,
      topics_text: '',
      notes: '',
    }).select('*').single();

    if (error) {
      toast('error', 'Failed to add learning day');
    } else {
      const newDay = data as SessionDay;
      setSessionDays([...sessionDays, newDay]);
      setEditingDayId(newDay.id);
      setDayForm({ topics_text: '', notes: '' });
      toast('success', `Day ${nextDay} added`);
    }
    setSavingDay(false);
  }

  function startEditDay(day: SessionDay) {
    setEditingDayId(day.id);
    setDayForm({ topics_text: day.topics_text, notes: day.notes });
  }

  async function saveDay(day: SessionDay) {
    setSavingDay(true);
    const { error } = await supabase.from('session_days').update({
      topics_text: dayForm.topics_text,
      notes: dayForm.notes,
    }).eq('id', day.id);

    if (error) {
      toast('error', 'Failed to save learning day');
    } else {
      toast('success', 'Learning day saved');
      setSessionDays(sessionDays.map((d) =>
        d.id === day.id ? { ...d, topics_text: dayForm.topics_text, notes: dayForm.notes } : d
      ));
      setEditingDayId(null);
    }
    setSavingDay(false);
  }

  // End session flow
  async function handleEndSession() {
    if (!endSessionTarget || !profile) return;

    const existingParticipant = endSessionTarget.session_participants.find(
      (p) => p.user_id === profile.id
    );

    if (existingParticipant) {
      await supabase.from('session_participants')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', existingParticipant.id);
    } else {
      await supabase.from('session_participants').insert({
        session_id: endSessionTarget.id,
        user_id: profile.id,
        ended_at: new Date().toISOString(),
      });
    }

    let dayId: string | null = null;
    if (endSessionDay) {
      dayId = endSessionDay.id;
    } else if (sessionDays.length > 0) {
      dayId = sessionDays[sessionDays.length - 1].id;
    }

    const { data: existingFb } = await supabase
      .from('feedback')
      .select('id')
      .eq('session_day_id', dayId ?? '')
      .eq('rater_id', profile.id)
      .maybeSingle();

    setExistingFeedback(!!existingFb);
    setFeedbackSession(endSessionTarget);
    setFeedbackDay(dayId ? sessionDays.find((d) => d.id === dayId) ?? null : null);
    setRating(5);
    setComment('');
    setEndSessionTarget(null);
    setFeedbackModalOpen(true);
    loadSessions();
  }

  async function handleSubmitFeedback() {
    if (!feedbackSession || !profile) return;
    setSavingFeedback(true);

    const otherUserId = feedbackSession.mentor_id === profile.id
      ? feedbackSession.learner_id
      : feedbackSession.mentor_id;

    const { error } = await supabase.from('feedback').insert({
      request_id: feedbackSession.request_id,
      skill_id: feedbackSession.skill_id,
      session_day_id: feedbackDay?.id ?? null,
      rater_id: profile.id,
      ratee_id: otherUserId,
      rating,
      comment: comment.trim(),
    });

    if (error) {
      toast('error', 'Failed to submit feedback');
    } else {
      toast('success', 'Feedback submitted successfully');
      setFeedbackModalOpen(false);
      setFeedbackSession(null);
      setFeedbackDay(null);
    }
    setSavingFeedback(false);
  }

  const filtered = sessions.filter((s) => {
    if (tab === 'upcoming') return s.session_date > todayStr && s.status === 'Scheduled';
    if (tab === 'today') return s.session_date === todayStr && s.status === 'Scheduled';
    return s.session_date < todayStr || s.status !== 'Scheduled';
  });

  if (loading) return <LoadingSpinner className="py-20" size={32} />;

  const requestOptions = acceptedRequests.map((r) => ({
    id: r.id,
    label: `${r.skills?.name ?? 'Skill'} — ${r.requester_id === profile?.id ? r.receiver_profile?.full_name ?? 'Mentor' : r.requester_profile?.full_name ?? 'Learner'}`,
  }));

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Learning Sessions
            {isAdmin && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1"><Shield size={12} /> Admin</span>}
          </h1>
          <p className="text-gray-500 mt-1">{isAdmin ? 'Manage all learning sessions' : 'Schedule and manage your learning sessions'}</p>
        </div>
        <Button onClick={openScheduleModal}><Plus size={18} /> Schedule Session</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['upcoming', 'today', 'past'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${tab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'today' ? "Today's" : t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100">
          <EmptyState
            icon={<CalendarDays size={48} />}
            title={tab === 'upcoming' ? "No upcoming sessions" : tab === 'today' ? "No sessions today" : "No past sessions"}
            message={tab === 'upcoming' ? "Schedule a session after a learning request is accepted." : tab === 'today' ? "You have no sessions scheduled for today." : "Your completed sessions will appear here."}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => {
            const isMentor = s.mentor_id === profile?.id;
            const isParticipant = isMentor || s.learner_id === profile?.id;
            const partnerName = isMentor ? s.learner_profile?.full_name : s.mentor_profile?.full_name;
            const partnerLabel = isMentor ? 'Learner' : 'Mentor';
            const myParticipant = s.session_participants?.find((p) => p.user_id === profile?.id);
            const hasEnded = !!myParticipant?.ended_at;
            const isExpanded = expandedSession === s.id;
            const canManage = isParticipant || isAdmin;

            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">{s.skills?.name ?? 'Session'}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {isParticipant ? `You are the ${isMentor ? 'Mentor' : 'Learner'}` : 'Admin view'}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    {partnerName && (
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" /> {partnerLabel}: <span className="font-medium text-gray-700">{partnerName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-gray-400" /> {new Date(s.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-gray-400" /> {s.session_time}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.mode === 'Online' ? <Video size={16} className="text-gray-400" /> : <MapPin size={16} className="text-gray-400" />} {s.mode}
                    </div>
                  </div>

                  {s.mode === 'Online' && (
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 truncate" title={MEETING_URL}>
                        {MEETING_URL}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleShareSession(s)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-colors"
                          title="Share session with learner"
                        >
                          <Share2 size={16} /> Share
                        </button>
                        <button
                          onClick={handleJoinMeeting}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <LogIn size={16} /> Join Meeting
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {s.status === 'Scheduled' && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-50">
                      {isParticipant && (
                        <Button size="sm" variant="secondary" onClick={() => toggleExpand(s.id)}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Day-wise Learning
                        </Button>
                      )}
                      {isParticipant && !hasEnded && (
                        <Button size="sm" variant="danger" onClick={() => { setEndSessionTarget(s); setEndSessionDay(null); }}>
                          <X size={16} /> End Session
                        </Button>
                      )}
                      {isParticipant && hasEnded && (
                        <span className="text-xs text-gray-500 flex items-center gap-1 px-3 py-1.5 bg-gray-50 rounded-lg">
                          <CheckCircle2 size={14} /> You ended this session
                        </span>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(s)}>
                          <Pencil size={14} /> Edit
                        </Button>
                      )}
                      {canManage && tab !== 'past' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateSessionStatus(s.id, 'Done')}>Mark Done</Button>
                          <Button size="sm" variant="ghost" onClick={() => updateSessionStatus(s.id, 'Cancelled')}>Cancel</Button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Day-wise learning section */}
                {isExpanded && isParticipant && (
                  <div className="border-t border-gray-100 bg-slate-50/50 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Learning Plan</h4>
                      <Button size="sm" variant="secondary" onClick={() => addDay(s.id)} disabled={savingDay}>
                        <Plus size={14} /> Add Day
                      </Button>
                    </div>

                    {loadingDays ? (
                      <p className="text-sm text-gray-400">Loading...</p>
                    ) : sessionDays.length === 0 ? (
                      <p className="text-sm text-gray-400 py-3">No learning days yet. Click "Add Day" to start your day-wise learning plan.</p>
                    ) : (
                      <div className="space-y-3">
                        {sessionDays.map((day) => (
                          <div key={day.id} className="bg-white rounded-lg border border-gray-100 p-4">
                            {editingDayId === day.id ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-700">Day {day.day_number}</span>
                                  <div className="flex gap-2">
                                    <button onClick={() => saveDay(day)} disabled={savingDay} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
                                      <Save size={16} />
                                    </button>
                                    <button onClick={() => setEditingDayId(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50">
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                                <TextArea
                                  label="Topics for this day"
                                  value={dayForm.topics_text}
                                  onChange={(e) => setDayForm({ ...dayForm, topics_text: e.target.value })}
                                  placeholder="e.g., Introduction to HTML, document structure, headings and paragraphs"
                                  rows={3}
                                />
                                <TextArea
                                  label="What was taught / Learning notes"
                                  value={dayForm.notes}
                                  onChange={(e) => setDayForm({ ...dayForm, notes: e.target.value })}
                                  placeholder="Notes on what was covered, examples discussed, practice given..."
                                  rows={3}
                                />
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-semibold text-gray-700">Day {day.day_number}</span>
                                  <div className="flex gap-1">
                                    <button onClick={() => startEditDay(day)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50">
                                      <Pencil size={14} />
                                    </button>
                                    {!hasEnded && (
                                      <button
                                        onClick={() => { setEndSessionTarget(s); setEndSessionDay(day); }}
                                        className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                                      >
                                        Finish Day
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {day.topics_text ? (
                                  <div className="mb-2">
                                    <p className="text-xs font-medium text-gray-500 mb-1">Topics</p>
                                    <div className="flex items-start gap-2">
                                      <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{day.topics_text}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400 mb-2">No topics set. Click edit to add.</p>
                                )}
                                {day.notes && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{day.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule a Session">
        <div className="space-y-4">
          {acceptedRequests.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No accepted requests available. A request must be accepted before you can schedule a session.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Accepted Request <span className="text-red-500">*</span></label>
                <select
                  value={form.request_id}
                  onChange={(e) => setForm({ ...form, request_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                >
                  <option value="">Choose a request...</option>
                  {requestOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Date" type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} required />
                <Input label="Time" type="time" value={form.session_time} onChange={(e) => setForm({ ...form, session_time: e.target.value })} required />
              </div>
              <Select label="Mode" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} options={['Online', 'Offline']} required />

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSchedule} disabled={saving}>{saving ? 'Scheduling...' : 'Schedule'}</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Admin edit session modal */}
      <Modal open={!!editingSession} onClose={() => setEditingSession(null)} title="Edit Session (Admin)">
        {editingSession && (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
              <span className="font-semibold">{editingSession.skills?.name ?? 'Session'}</span>
              {' — '}Mentor: {editingSession.mentor_profile?.full_name ?? 'Unknown'} | Learner: {editingSession.learner_profile?.full_name ?? 'Unknown'}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date" type="date" value={editForm.session_date} onChange={(e) => setEditForm({ ...editForm, session_date: e.target.value })} required />
              <Input label="Time" type="time" value={editForm.session_time} onChange={(e) => setEditForm({ ...editForm, session_time: e.target.value })} required />
            </div>
            <Select label="Mode" value={editForm.mode} onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })} options={['Online', 'Offline']} required />
            <Select label="Status" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} options={['Scheduled', 'Done', 'Cancelled']} required />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setEditingSession(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* End session confirmation */}
      <Modal open={!!endSessionTarget} onClose={() => setEndSessionTarget(null)} title="End Session" size="sm">
        <p className="text-gray-600">
          Are you sure you want to end this session{endSessionDay ? ` (Day ${endSessionDay.day_number})` : ''}? You'll be asked to leave feedback after ending.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setEndSessionTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleEndSession}>End Session</Button>
        </div>
      </Modal>

      {/* Feedback modal (auto-shown after ending session) */}
      <Modal open={feedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} title="Rate Your Learning Session">
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-sm text-emerald-700">
              Rate <span className="font-semibold">{feedbackSession?.mentor_id === profile?.id ? feedbackSession?.learner_profile?.full_name : feedbackSession?.mentor_profile?.full_name}</span>
              {feedbackDay && <> for Day {feedbackDay.day_number}</>}
              {feedbackSession && <> — {feedbackSession.skills?.name}</>}
            </p>
          </div>

          {existingFeedback && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-700">
              You've already submitted feedback for this session day. Submitting again will add another entry.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star size={32} className={n <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-500">
                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][hoverRating || rating]}
              </span>
            </div>
          </div>

          <TextArea
            label="Written Feedback"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How was today's learning session? What did you understand well? What could be improved?"
            rows={4}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setFeedbackModalOpen(false)}>Skip</Button>
            <Button onClick={handleSubmitFeedback} disabled={savingFeedback}>
              {savingFeedback ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share session confirmation modal */}
      <Modal
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        title="Share Session"
        size="sm"
      >
        {shareTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-sm text-emerald-700">
                Share this learning session with <span className="font-semibold">{shareTarget.learner_profile?.full_name ?? 'the learner'}</span>?
              </p>
            </div>

            <div className="rounded-lg border border-gray-100 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <VideoIcon size={16} className="text-gray-400" />
                <span className="font-medium text-gray-700">{shareTarget.skills?.name ?? 'Session'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CalendarDays size={16} className="text-gray-400" /> {new Date(shareTarget.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock size={16} className="text-gray-400" /> {shareTarget.session_time}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User size={16} className="text-gray-400" /> Learner: <span className="font-medium text-gray-700">{shareTarget.learner_profile?.full_name ?? 'Unknown'}</span>
              </div>
              {shareTarget.meeting_link && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 truncate">
                  <Video size={14} /> {shareTarget.meeting_link}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShareTarget(null)}>Cancel</Button>
              <Button onClick={() => handleShareToChat(shareTarget)}>
                <Send size={16} /> Share to Chat
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
