import { useEffect, useState, useCallback } from 'react';
import { Star, Send, Inbox } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';

type FeedbackTab = 'received' | 'given';

interface FeedbackRecord {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  rater_id: string;
  ratee_id: string;
  skill_id: string;
  session_day_id: string | null;
  rater_profile: { full_name: string } | null;
  ratee_profile: { full_name: string } | null;
  skills: { name: string } | null;
  session_days: { day_number: number } | null;
}

export default function Feedback() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<FeedbackTab>('received');
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeedback = useCallback(async () => {
    if (!profile) return;
    const column = tab === 'received' ? 'ratee_id' : 'rater_id';
    const { data } = await supabase
      .from('feedback')
      .select(`
        id, rating, comment, created_at,
        rater_id, ratee_id, skill_id, session_day_id,
        rater_profile:profiles!feedback_rater_id_fkey(full_name),
        ratee_profile:profiles!feedback_ratee_id_fkey(full_name),
        skills:skill_id(name),
        session_days:session_day_id(day_number)
      `)
      .eq(column, profile.id)
      .order('created_at', { ascending: false });
    setFeedback((data as unknown as FeedbackRecord[]) ?? []);
    setLoading(false);
  }, [profile, tab]);

  useEffect(() => { setLoading(true); loadFeedback(); }, [loadFeedback]);

  if (loading) return <LoadingSpinner className="py-20" size={32} />;

  const avgRating = feedback.length > 0 && tab === 'received'
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Ratings & Feedback ⭐</h1>
        <p className="text-gray-500 mt-1">View feedback from your learning sessions</p>
      </div>

      {/* Rating summary */}
      {tab === 'received' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-gray-800">{avgRating ?? 'N/A'}</p>
            <div className="flex items-center gap-0.5 mt-1 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={16} className={n <= Math.round(Number(avgRating ?? 0)) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{feedback.length} review{feedback.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="h-12 w-px bg-gray-100" />
          <p className="text-sm text-gray-500 flex-1">Feedback from students who learned from you appears here. Complete a learning session to leave feedback for your mentor.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['received', 'given'] as FeedbackTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'received' ? 'Received' : 'Given'}
          </button>
        ))}
      </div>

      {/* Feedback list */}
      {feedback.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100">
          <EmptyState
            icon={tab === 'received' ? <Inbox size={48} /> : <Send size={48} />}
            title={tab === 'received' ? "No feedback received" : "No feedback given"}
            message={tab === 'received' ? "Feedback from students you've taught will appear here." : "End a learning session to leave feedback for your mentor."}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((fb) => {
            const otherName = tab === 'received'
              ? fb.rater_profile?.full_name ?? 'Anonymous'
              : fb.ratee_profile?.full_name ?? 'Anonymous';
            const otherLabel = tab === 'received' ? 'From' : 'To';
            const initials = otherName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
            return (
              <div key={fb.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-semibold">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{otherName}</p>
                      <p className="text-xs text-gray-400">
                        {otherLabel} · {fb.skills?.name ?? ''}
                        {fb.session_days?.day_number && <> · Day {fb.session_days.day_number}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={14} className={n <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                    ))}
                  </div>
                </div>
                {fb.comment && <p className="text-sm text-gray-600 mt-2">{fb.comment}</p>}
                <p className="text-xs text-gray-300 mt-2">{new Date(fb.created_at).toLocaleDateString()}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
