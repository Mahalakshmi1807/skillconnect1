import { useState, useEffect } from 'react';
import { User, Mail, BookOpen, Star, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Input, TextArea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/Loading';
import { toast } from '@/components/ui/Toast';

const DEPARTMENTS = [
  'Computer Science', 'Information Technology', 'Electronics & Communication',
  'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering',
  'Business Administration', 'Arts & Humanities', 'Science', 'Other',
];

export default function Profile() {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  // Skills + rating summary
  const [skillCount, setSkillCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: skills }, { data: feedback }] = await Promise.all([
        supabase.from('skills').select('id', { count: 'exact' }).eq('user_id', profile.id),
        supabase.from('feedback').select('rating').eq('ratee_id', profile.id),
      ]);
      setSkillCount(skills?.length ?? 0);
      const ratings = feedback ?? [];
      setFeedbackCount(ratings.length);
      setAvgRating(ratings.length > 0 ? ratings.reduce((s, r) => s + (r as { rating: number }).rating, 0) / ratings.length : 0);
      setLoadingStats(false);
    })();
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    if (!fullName.trim()) { toast('error', 'Name cannot be empty'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), department, bio })
      .eq('id', profile.id);
    if (error) {
      toast('error', 'Failed to update profile');
    } else {
      toast('success', 'Profile updated successfully');
      refreshProfile();
    }
    setSaving(false);
  }

  if (!profile) return <LoadingSpinner className="py-20" size={32} />;

  const initials = fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <p className="text-gray-500 mt-1">View and update your personal information</p>
      </div>

      {/* Profile header card */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-600" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shrink-0">
              {initials}
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-bold text-gray-800">{fullName}</h2>
              <p className="text-sm text-gray-400">{user?.email}</p>
            </div>
          </div>

          {/* Stats */}
          {!loadingStats && (
            <div className="flex gap-6 mt-6 pt-6 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-gray-400" />
                <div>
                  <p className="text-lg font-bold text-gray-800">{skillCount}</p>
                  <p className="text-xs text-gray-400">Skills Offered</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Star size={18} className="text-gray-400" />
                <div>
                  <p className="text-lg font-bold text-gray-800">{avgRating.toFixed(1)}</p>
                  <p className="text-xs text-gray-400">Avg Rating ({feedbackCount})</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Profile</h3>
        <div className="space-y-4 max-w-lg">
          <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} icon={<User size={18} />} />
          <Input label="Email" value={user?.email ?? ''} onChange={() => {}} disabled icon={<Mail size={18} />} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            >
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <TextArea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell other students about yourself..." rows={3} />
          <Button onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
