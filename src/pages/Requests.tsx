import { useEffect, useState, useCallback } from 'react';
import { Send, Check, X, Clock, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { toast } from '@/components/ui/Toast';
import type { RequestWithDetails } from '@/types';

type Tab = 'received' | 'sent';

export default function Requests() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('received');
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!profile) return;
    const column = tab === 'received' ? 'receiver_id' : 'requester_id';
    const { data } = await supabase
      .from('skill_requests')
      .select(`
        *,
        skills:skill_id(name, category),
        requester_profile:profiles!skill_requests_requester_id_fkey(full_name, department),
        receiver_profile:profiles!skill_requests_receiver_id_fkey(full_name, department)
      `)
      .eq(column, profile.id)
      .order('created_at', { ascending: false });
    setRequests((data as RequestWithDetails[]) ?? []);
    setLoading(false);
  }, [profile, tab]);

  useEffect(() => { setLoading(true); loadRequests(); }, [loadRequests]);

  async function updateStatus(id: string, status: 'accepted' | 'rejected') {
    setUpdating(id);
    const { error } = await supabase
      .from('skill_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast('error', 'Failed to update request');
    } else {
      toast('success', `Request ${status}`);
      loadRequests();
    }
    setUpdating(null);
  }

  async function cancelRequest(id: string) {
    setUpdating(id);
    const { error } = await supabase.from('skill_requests').delete().eq('id', id);
    if (error) toast('error', 'Failed to cancel request');
    else { toast('success', 'Request cancelled'); loadRequests(); }
    setUpdating(null);
  }

  if (loading) return <LoadingSpinner className="py-20" size={32} />;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Skill Requests 📩</h1>
        <p className="text-gray-500 mt-1">Manage your incoming and outgoing learning requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['received', 'sent'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${tab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {/* List */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100">
          <EmptyState
            icon={tab === 'received' ? <ArrowRightLeft size={48} /> : <Send size={48} />}
            title={tab === 'received' ? "No incoming requests" : "No sent requests"}
            message={tab === 'received' ? "When other students request to learn from you, they'll appear here." : "Browse students and send a learning request to get started."}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const otherProfile = tab === 'received' ? req.requester_profile : req.receiver_profile;
            const otherName = otherProfile?.full_name ?? 'Unknown';
            const initials = otherName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-800">{req.skills?.name ?? 'Unknown skill'}</h3>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {tab === 'received' ? 'From' : 'To'}: <span className="font-medium text-gray-700">{otherName}</span>
                    {otherProfile?.department && <span className="text-gray-400"> · {otherProfile.department}</span>}
                  </p>
                  {req.message && <p className="text-sm text-gray-400 mt-1 italic line-clamp-1">"{req.message}"</p>}
                  <p className="text-xs text-gray-300 mt-1">{new Date(req.created_at).toLocaleDateString()}</p>
                </div>

                {/* Actions */}
                {tab === 'received' && req.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStatus(req.id, 'accepted')} disabled={updating === req.id}>
                      <Check size={16} /> Accept
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => updateStatus(req.id, 'rejected')} disabled={updating === req.id}>
                      <X size={16} /> Reject
                    </Button>
                  </div>
                )}
                {tab === 'sent' && req.status === 'pending' && (
                  <Button size="sm" variant="secondary" onClick={() => cancelRequest(req.id)} disabled={updating === req.id}>
                    Cancel
                  </Button>
                )}
                {req.status === 'accepted' && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1"><Clock size={14} /> Active</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
