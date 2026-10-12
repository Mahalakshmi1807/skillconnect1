import { useEffect, useState, useCallback } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Input, Select, TextArea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { toast } from '@/components/ui/Toast';
import {
  SKILL_CATEGORIES, PROFICIENCY_LEVELS, LEARNING_PREFERENCES,
  type Skill
} from '@/types';

const emptyForm = { name: '', category: 'Programming', proficiency_level: 'Intermediate', description: '', learning_preference: 'Both' };

export default function MySkills() {
  const { profile } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [adding, setAdding] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  const loadSkills = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('skills')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setSkills((data as Skill[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  async function handleAdd() {
    if (!addForm.name.trim()) {
      toast('error', 'Skill name is required');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('skills').insert({ ...addForm, user_id: profile?.id });
    if (error) {
      toast('error', 'Failed to add skill');
    } else {
      toast('success', 'Skill added successfully');
      setAddForm({ ...emptyForm });
      loadSkills();
    }
    setAdding(false);
  }

  function openEdit(skill: Skill) {
    setEditingSkill(skill);
    setEditForm({
      name: skill.name,
      category: skill.category,
      proficiency_level: skill.proficiency_level,
      description: skill.description,
      learning_preference: skill.learning_preference,
    });
    setEditModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingSkill) return;
    if (!editForm.name.trim()) {
      toast('error', 'Skill name is required');
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase.from('skills').update(editForm).eq('id', editingSkill.id);
    if (error) {
      toast('error', 'Failed to update skill');
    } else {
      toast('success', 'Skill updated successfully');
      setEditModalOpen(false);
      loadSkills();
    }
    setSavingEdit(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('skills').delete().eq('id', deleteTarget.id);
    if (error) toast('error', 'Failed to delete skill');
    else { toast('success', 'Skill deleted'); setDeleteTarget(null); loadSkills(); }
  }

  const filtered = skills.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || s.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) return <LoadingSpinner className="py-20" size={32} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Skills</h1>
        <p className="text-gray-500 mt-1">Add your skills and connect with other students.</p>
      </div>

      {/* Add New Skill card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Skill</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Skill Name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g., Python Programming" required />
            <Select label="Category" value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} options={SKILL_CATEGORIES} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Skill Level" value={addForm.proficiency_level} onChange={(e) => setAddForm({ ...addForm, proficiency_level: e.target.value })} options={PROFICIENCY_LEVELS} required />
            <Select label="Learning Preference" value={addForm.learning_preference} onChange={(e) => setAddForm({ ...addForm, learning_preference: e.target.value })} options={LEARNING_PREFERENCES} required />
          </div>
          <TextArea label="Skill Description" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="Describe what you'll teach..." rows={3} />
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={adding}>
              <Plus size={18} /> {adding ? 'Adding...' : 'Add Skill'}
            </Button>
          </div>
        </div>
      </div>

      {/* My Skills list card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">My Skills</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="sm:w-56">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search skills..." icon={<Search size={18} />} />
            </div>
            <div className="sm:w-44">
              <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} options={SKILL_CATEGORIES} placeholder="All Categories" />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<BookOpen size={48} />} title={skills.length === 0 ? "No skills yet" : "No skills found"} message={skills.length === 0 ? "Add your first skill using the form above." : "Try adjusting your search or filter."} />
        ) : (
          <div className="space-y-3">
            {filtered.map((skill) => (
              <div key={skill.id} className="rounded-xl border border-gray-100 p-4 hover:border-emerald-200 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-800">{skill.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="green">{skill.category}</Badge>
                      <Badge variant="blue">{skill.proficiency_level}</Badge>
                      <Badge variant="gray">{skill.learning_preference}</Badge>
                    </div>
                    {skill.description && <p className="text-sm text-gray-500 mt-2">{skill.description}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(skill)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(skill)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Skill">
        <div className="space-y-4">
          <Input label="Skill Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="e.g., Python Programming" required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Category" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} options={SKILL_CATEGORIES} required />
            <Select label="Skill Level" value={editForm.proficiency_level} onChange={(e) => setEditForm({ ...editForm, proficiency_level: e.target.value })} options={PROFICIENCY_LEVELS} required />
          </div>
          <Select label="Learning Preference" value={editForm.learning_preference} onChange={(e) => setEditForm({ ...editForm, learning_preference: e.target.value })} options={LEARNING_PREFERENCES} required />
          <TextArea label="Skill Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Describe what you'll teach..." rows={3} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Skill" size="sm">
        <p className="text-gray-600">Are you sure you want to delete <span className="font-semibold text-gray-800">{deleteTarget?.name}</span>? This action cannot be undone.</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
