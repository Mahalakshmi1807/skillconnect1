import { useEffect, useState, useCallback } from 'react';
import { Users, Search, Send, MapPin, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Input, Select, TextArea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { toast } from '@/components/ui/Toast';
import { SKILL_CATEGORIES, PROFICIENCY_LEVELS, type Profile, type Skill } from '@/types';

interface StudentWithSkills {
  profile: Profile;
  skills: Skill[];
}

export default function BrowseStudents() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentWithSkills[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLevel, setFilterLevel] = useState('');

  const [requestTarget, setRequestTarget] = useState<{ skill: Skill; studentName: string } | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!profile) return;

    // Fetch all profiles except the current user
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', profile.id)
      .order('full_name', { ascending: true });

    if (!profilesData || profilesData.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    // Fetch all skills from those students
    const profileIds = profilesData.map((p) => p.id);
    const { data: skillsData } = await supabase
      .from('skills')
      .select('*')
      .in('user_id', profileIds)
      .order('created_at', { ascending: false });

    const skillsByUser = new Map<string, Skill[]>();
    for (const s of (skillsData as Skill[]) ?? []) {
      const arr = skillsByUser.get(s.user_id) ?? [];
      arr.push(s);
      skillsByUser.set(s.user_id, arr);
    }

    const combined: StudentWithSkills[] = (profilesData as Profile[]).map((p) => ({
      profile: p,
      skills: skillsByUser.get(p.id) ?? [],
    }));

    setStudents(combined);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  async function handleSendRequest() {
    if (!requestTarget || !profile) return;
    setSending(true);

    // Check for duplicate request
    const { data: existing } = await supabase
      .from('skill_requests')
      .select('id')
      .eq('requester_id', profile.id)
      .eq('skill_id', requestTarget.skill.id)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existing) {
      toast('warning', 'You already have an active request for this skill');
      setSending(false);
      setRequestTarget(null);
      return;
    }

    const { error } = await supabase.from('skill_requests').insert({
      requester_id: profile.id,
      receiver_id: requestTarget.skill.user_id,
      skill_id: requestTarget.skill.id,
      message: requestMessage,
      status: 'pending',
    });

    if (error) {
      toast('error', 'Failed to send request');
    } else {
      toast('success', 'Learning request sent!');
      setRequestMessage('');
      setRequestTarget(null);
    }
    setSending(false);
  }

  // Filter: by student name or skill name
  const filtered = students.filter((s) => {
    const matchesSearch =
      s.profile.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.skills.some((sk) => sk.name.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !filterCategory || s.skills.some((sk) => sk.category === filterCategory);
    const matchesLevel = !filterLevel || s.skills.some((sk) => sk.proficiency_level === filterLevel);
    return matchesSearch && matchesCategory && matchesLevel;
  });

  if (loading) return <LoadingSpinner className="py-20" size={32} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Browse Students</h1>
          <p className="text-gray-500 mt-1">Discover skills offered by other students</p>
        </div>
        <div className="flex gap-3">
          <div className="sm:w-48">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by Skill..." icon={<Search size={18} />} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="sm:w-44">
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} options={SKILL_CATEGORIES} placeholder="All Categories" />
        </div>
        <div className="sm:w-40">
          <Select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} options={PROFICIENCY_LEVELS} placeholder="All Levels" />
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100">
          <EmptyState icon={<Users size={48} />} title="No students found" message="Try adjusting your search or filters. New students will appear here after they register." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(({ profile: studentProfile, skills: studentSkills }) => {
            const initials = studentProfile.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
            return (
              <div key={studentProfile.id} className="bg-white rounded-xl border border-gray-100 p-5 card-hover">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-800 truncate">{studentProfile.full_name}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <MapPin size={12} /> {studentProfile.department}
                    </div>
                  </div>
                </div>

                {studentProfile.bio && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{studentProfile.bio}</p>}

                {studentSkills.length > 0 ? (
                  <div className="space-y-2">
                    {studentSkills.slice(0, 3).map((skill) => (
                      <div key={skill.id} className="rounded-lg bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-700 truncate">{skill.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant="green">{skill.category}</Badge>
                              <Badge variant="blue">{skill.proficiency_level}</Badge>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => setRequestTarget({ skill, studentName: studentProfile.full_name })}>
                            <Send size={14} /> Request
                          </Button>
                        </div>
                        {skill.description && <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{skill.description}</p>}
                      </div>
                    ))}
                    {studentSkills.length > 3 && (
                      <p className="text-xs text-gray-400 text-center pt-1">+{studentSkills.length - 3} more skill{studentSkills.length - 3 !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <BookOpen size={16} /> No skills added yet
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Request modal */}
      <Modal open={!!requestTarget} onClose={() => setRequestTarget(null)} title="Send Learning Request">
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-sm text-emerald-700">
              You're requesting to learn <span className="font-semibold">{requestTarget?.skill.name}</span>
              {requestTarget?.studentName && <> from <span className="font-semibold">{requestTarget.studentName}</span></>}
            </p>
          </div>
          <TextArea
            label="Message (optional)"
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            placeholder="Introduce yourself and explain why you want to learn this skill..."
            rows={4}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setRequestTarget(null)}>Cancel</Button>
            <Button onClick={handleSendRequest} disabled={sending}>
              {sending ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
