import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, GraduationCap, Send, CheckCircle2, CalendarDays,
  Star, Plus, Users, MessageSquare, ArrowRight, Shield
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui/Loading';

interface DashboardStats {
  skillsOffered: number;
  pendingRequests: number;
  acceptedRequests: number;
  upcomingSessions: number;
  avgRating: number;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!profile) return;
      const userId = profile.id;
      const today = new Date().toISOString().split('T')[0];

      const [skills, pendingReq, acceptedReq, upcoming, ratings] = await Promise.all([
        supabase.from('skills').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('skill_requests').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'pending'),
        supabase.from('skill_requests').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'accepted'),
        isAdmin
          ? supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('status', 'Scheduled').gte('session_date', today)
          : supabase.from('sessions').select('id', { count: 'exact', head: true }).or(`mentor_id.eq.${userId},learner_id.eq.${userId}`).eq('status', 'Scheduled').gte('session_date', today),
        supabase.from('feedback').select('rating').eq('ratee_id', userId),
      ]);

      const allRatings = ratings.data ?? [];
      const avg = allRatings.length > 0
        ? allRatings.reduce((sum, r) => sum + (r as { rating: number }).rating, 0) / allRatings.length
        : 0;

      setStats({
        skillsOffered: skills.count ?? 0,
        pendingRequests: pendingReq.count ?? 0,
        acceptedRequests: acceptedReq.count ?? 0,
        upcomingSessions: upcoming.count ?? 0,
        avgRating: Math.round(avg * 10) / 10,
      });
      setLoading(false);
    }
    loadStats();
  }, [profile, isAdmin]);

  if (loading) return <LoadingSpinner className="py-20" size={32} />;

  const statCards = [
    { label: 'Skills Offered', value: stats?.skillsOffered ?? 0, icon: BookOpen, color: 'from-emerald-500 to-teal-600' },
    { label: 'Pending Requests', value: stats?.pendingRequests ?? 0, icon: Send, color: 'from-amber-500 to-orange-600' },
    { label: 'Accepted Requests', value: stats?.acceptedRequests ?? 0, icon: CheckCircle2, color: 'from-emerald-500 to-green-600' },
    { label: 'Upcoming Sessions', value: stats?.upcomingSessions ?? 0, icon: CalendarDays, color: 'from-blue-500 to-indigo-600' },
    { label: 'Avg Rating', value: stats?.avgRating ?? 0, icon: Star, color: 'from-yellow-500 to-amber-600' },
  ];

  const quickActions = [
    { to: '/skills', label: 'Add a Skill', icon: Plus },
    { to: '/browse', label: 'Browse Students', icon: Users },
    { to: '/requests', label: 'View Requests', icon: Send },
    { to: '/chat', label: 'Open Chat', icon: MessageSquare },
    { to: '/sessions', label: 'Schedule Session', icon: CalendarDays },
    { to: '/feedback', label: 'Give Feedback', icon: Star },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/3" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Student'}! 👋</h1>
          <p className="text-emerald-100">
            {isAdmin ? 'You are signed in as Admin — manage all sessions and learning activities.' : "Here's what's happening with your skill exchange journey."}
          </p>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
              <Shield size={12} /> Admin Mode
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100 stat-card card-hover">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-3`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-emerald-100 flex items-center justify-center text-gray-500 group-hover:text-emerald-600 transition-colors">
                <Icon size={20} />
              </div>
              <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Get started CTA */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800">New to SkillConnect?</h3>
          <p className="text-sm text-gray-500 mt-1">Add your first skill and start connecting with other students.</p>
        </div>
        <Link
          to="/skills"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          Get Started <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
