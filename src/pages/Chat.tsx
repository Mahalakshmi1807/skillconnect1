import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare, Send, ArrowLeft, Search, Paperclip, Mic, Square,
  X, Download, FileText, Play, Pause, MoreVertical, Pencil, Trash2,
  Check, Video, CalendarDays, Clock, ExternalLink, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { toast } from '@/components/ui/Toast';
import type { Profile, Message, SessionInvitationData } from '@/types';

const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_VOICE_SIZE = 5 * 1024 * 1024;

interface Conversation {
  partner: Profile;
  lastMessage: string;
  lastTime: string;
  messages: Message[];
}

interface PendingShare {
  targetUserId: string;
  invitation: SessionInvitationData;
}

function formatLastMessage(msg: Message | undefined): string {
  if (!msg) return 'Start chatting...';
  if (msg.is_deleted_for_everyone) return 'This message was deleted';
  if (msg.message_type === 'session_invitation') return 'Session invitation';
  if (msg.attachment_type === 'voice') return 'Voice message';
  if (msg.attachment_url) return msg.attachment_name ?? 'Attachment';
  return msg.content ?? '';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'PDF';
  if (ext === 'doc' || ext === 'docx') return 'DOC';
  if (ext === 'txt') return 'TXT';
  if (ext === 'xls' || ext === 'xlsx') return 'XLS';
  return ext.toUpperCase() ?? 'FILE';
}

export default function Chat() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File attachment state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  // Audio playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Message edit/delete state
  const [contextMenuMsg, setContextMenuMsg] = useState<Message | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<'me' | 'everyone' | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session share state (incoming from Sessions page)
  const [pendingShare, setPendingShare] = useState<PendingShare | null>(null);

  // Read navigation state for session sharing
  useEffect(() => {
    const state = location.state as { shareTargetUserId?: string; shareInvitation?: SessionInvitationData } | null;
    if (state?.shareTargetUserId && state?.shareInvitation) {
      setPendingShare({ targetUserId: state.shareTargetUserId, invitation: state.shareInvitation });
      setActivePartnerId(state.shareTargetUserId);
      // Clear the navigation state so it doesn't re-trigger
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    const { data: requests } = await supabase
      .from('skill_requests')
      .select('id, requester_id, receiver_id, status')
      .or(`requester_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .in('status', ['accepted', 'completed']);

    if (!requests || requests.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const partnerIds = new Set<string>();
    requests.forEach((r) => {
      const partnerId = r.requester_id === profile.id ? r.receiver_id : r.requester_id;
      partnerIds.add(partnerId);
    });

    const { data: partnerProfiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', Array.from(partnerIds));

    const convos: Conversation[] = [];
    for (const partner of (partnerProfiles as Profile[]) ?? []) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true });

      const allMessages = (msgs as Message[]) ?? [];
      // Filter out messages deleted-for-me by current user
      const visibleMessages = allMessages.filter(
        (m) => !m.deleted_for_user_ids?.includes(profile.id)
      );
      const last = visibleMessages[visibleMessages.length - 1];
      convos.push({
        partner,
        lastMessage: formatLastMessage(last),
        lastTime: last?.created_at ?? '',
        messages: visibleMessages,
      });
    }

    convos.sort((a, b) => (b.lastTime || '').localeCompare(a.lastTime || ''));
    setConversations(convos);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadConversations();
    pollRef.current = setInterval(loadConversations, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activePartnerId]);

  async function handleSend() {
    if (!draft.trim() || !activePartnerId || !profile) return;
    setSending(true);
    const content = draft.trim();
    setDraft('');

    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      receiver_id: activePartnerId,
      content,
    });

    if (error) {
      toast('error', 'Failed to send message');
      setDraft(content);
    } else {
      loadConversations();
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Session invitation send
  async function handleSendInvitation() {
    if (!pendingShare || !profile) return;
    const inv = pendingShare.invitation;
    if (!inv.meeting_url) {
      toast('error', 'Meeting URL is missing for this session');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      receiver_id: pendingShare.targetUserId,
      content: `Session Invitation: ${inv.skill_name} — ${inv.session_date} at ${inv.session_time}`,
      message_type: 'session_invitation',
      session_invitation_data: inv,
    });

    if (error) {
      toast('error', 'Failed to send session invitation');
    } else {
      toast('success', 'Session invitation sent');
      setPendingShare(null);
      loadConversations();
    }
    setSending(false);
  }

  // Message edit
  function startEdit(msg: Message) {
    setEditingMsgId(msg.id);
    setEditContent(msg.content ?? '');
    setContextMenuMsg(null);
    setContextMenuPos(null);
  }

  async function saveEdit(msg: Message) {
    if (!profile) return;
    const trimmed = editContent.trim();
    if (!trimmed) {
      toast('error', 'Message cannot be empty');
      return;
    }
    const { error } = await supabase
      .from('messages')
      .update({ content: trimmed, is_edited: true, edited_at: new Date().toISOString() })
      .eq('id', msg.id)
      .eq('sender_id', profile.id);

    if (error) {
      toast('error', 'Failed to edit message');
    } else {
      toast('success', 'Message edited');
      setEditingMsgId(null);
      loadConversations();
    }
  }

  // Delete for me — append user ID to deleted_for_user_ids
  async function handleDeleteForMe(msg: Message) {
    if (!profile) return;
    const updatedIds = [...(msg.deleted_for_user_ids ?? []), profile.id];
    const { error } = await supabase
      .from('messages')
      .update({ deleted_for_user_ids: updatedIds })
      .eq('id', msg.id);

    if (error) {
      toast('error', 'Failed to delete message');
    } else {
      toast('success', 'Message deleted for you');
      setConfirmDeleteMsg(null);
      setDeleteTarget(null);
      loadConversations();
    }
  }

  // Delete for everyone — sender only
  async function handleDeleteForEveryone(msg: Message) {
    if (!profile) return;
    const { error } = await supabase
      .from('messages')
      .update({
        is_deleted_for_everyone: true,
        content: null,
        attachment_url: null,
        attachment_name: null,
        attachment_type: null,
      })
      .eq('id', msg.id)
      .eq('sender_id', profile.id);

    if (error) {
      toast('error', 'Failed to delete message');
    } else {
      toast('success', 'Message deleted for everyone');
      setConfirmDeleteMsg(null);
      setDeleteTarget(null);
      loadConversations();
    }
  }

  // Context menu
  function openContextMenu(msg: Message, x: number, y: number) {
    setContextMenuMsg(msg);
    setContextMenuPos({ x, y });
  }

  function closeContextMenu() {
    setContextMenuMsg(null);
    setContextMenuPos(null);
  }

  // Right-click handler
  function handleContextMenu(e: React.MouseEvent, msg: Message) {
    e.preventDefault();
    openContextMenu(msg, e.clientX, e.clientY);
  }

  // Long-press handlers for mobile
  function handleTouchStart(e: React.TouchEvent, msg: Message) {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      openContextMenu(msg, touch.clientX, touch.clientY);
    }, 500);
  }

  function handleTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  // Document attachment
  function handleFileClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile || !activePartnerId) return;

    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      toast('error', 'Only PDF, DOC, DOCX, TXT, XLS, and XLSX files are allowed');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast('error', 'File size must be under 10MB');
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    const ext = file.name.split('.').pop();
    const fileName = `${profile.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file);

    if (uploadError) {
      toast('error', 'Failed to upload document');
      setUploadingFile(false);
      e.target.value = '';
      return;
    }

    const { error: msgError } = await supabase.from('messages').insert({
      sender_id: profile.id,
      receiver_id: activePartnerId,
      content: null,
      attachment_url: filePath,
      attachment_name: file.name,
      attachment_type: file.type,
    });

    if (msgError) {
      toast('error', 'Failed to send document');
    } else {
      toast('success', 'Document sent');
      loadConversations();
    }

    setUploadingFile(false);
    e.target.value = '';
  }

  async function handleDownload(msg: Message) {
    if (!msg.attachment_url) return;
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(msg.attachment_url, 3600);
    if (error || !data) {
      toast('error', 'Failed to download file');
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  // Voice recording
  async function startRecording() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      toast('error', 'Voice recording is not supported in this browser');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast('error', 'Microphone access denied or unavailable');
    }
  }

  function stopRecording(send: boolean) {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      return;
    }

    recorder.onstop = async () => {
      if (recorder.stream) {
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

      if (!send) {
        setIsRecording(false);
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (audioBlob.size > MAX_VOICE_SIZE) {
        toast('error', 'Voice message is too long (max 5MB)');
        setIsRecording(false);
        return;
      }

      if (!profile || !activePartnerId) {
        setIsRecording(false);
        return;
      }

      setUploadingVoice(true);
      const filePath = `${profile.id}/${Date.now()}-voice.webm`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, audioBlob, { contentType: 'audio/webm' });

      if (uploadError) {
        toast('error', 'Failed to upload voice message');
        setUploadingVoice(false);
        setIsRecording(false);
        return;
      }

      const { error: msgError } = await supabase.from('messages').insert({
        sender_id: profile.id,
        receiver_id: activePartnerId,
        content: null,
        attachment_url: filePath,
        attachment_name: `Voice message (${recordingSeconds}s)`,
        attachment_type: 'voice',
      });

      if (msgError) {
        toast('error', 'Failed to send voice message');
      } else {
        toast('success', 'Voice message sent');
        loadConversations();
      }

      setUploadingVoice(false);
      setIsRecording(false);
      setRecordingSeconds(0);
    };

    recorder.stop();
  }

  // Audio playback
  async function toggleVoicePlay(msg: Message) {
    if (playingId === msg.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (!msg.attachment_url) return;
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(msg.attachment_url, 3600);

    if (error || !data) {
      toast('error', 'Failed to load voice message');
      return;
    }

    const audio = new Audio(data.signedUrl);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(msg.id);
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside() {
      closeContextMenu();
    }
    if (contextMenuMsg) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuMsg]);

  const activeConvo = conversations.find((c) => c.partner.id === activePartnerId);
  const filteredConvos = conversations.filter((c) =>
    c.partner.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner className="py-20" size={32} />;

  const isBusy = uploadingFile || uploadingVoice;

  function renderSessionInvitation(msg: Message, isSent: boolean) {
    const data = msg.session_invitation_data;
    if (!data) return null;

    return (
      <div className={`min-w-[260px] rounded-lg p-3 ${isSent ? 'bg-white/15' : 'bg-emerald-50 border border-emerald-100'}`}>
        <div className={`flex items-center gap-2 mb-2 ${isSent ? 'text-white' : 'text-emerald-700'}`}>
          <Video size={16} />
          <span className="text-xs font-bold uppercase tracking-wide">Session Invitation</span>
        </div>
        <p className={`text-sm font-semibold mb-2 ${isSent ? 'text-white' : 'text-gray-800'}`}>
          {data.skill_name}
        </p>
        <div className={`space-y-1 text-xs ${isSent ? 'text-emerald-50' : 'text-gray-600'}`}>
          <div className="flex items-center gap-2">
            <CalendarDays size={13} /> {new Date(data.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-2">
            <Clock size={13} /> {data.session_time}
          </div>
        </div>
        {data.meeting_url ? (
          <a
            href={data.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isSent ? 'bg-white text-emerald-700 hover:bg-emerald-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <ExternalLink size={14} /> Join Meeting
          </a>
        ) : (
          <p className={`mt-2 text-xs flex items-center gap-1 ${isSent ? 'text-red-200' : 'text-red-500'}`}>
            <AlertCircle size={13} /> Meeting URL not available
          </p>
        )}
      </div>
    );
  }

  function renderMessageContent(msg: Message, isSent: boolean) {
    if (msg.is_deleted_for_everyone) {
      return (
        <p className={`italic text-sm ${isSent ? 'text-emerald-200' : 'text-gray-400'}`}>
          This message was deleted
        </p>
      );
    }

    if (msg.message_type === 'session_invitation') {
      return renderSessionInvitation(msg, isSent);
    }

    if (msg.attachment_type === 'voice') {
      return (
        <div className="flex items-center gap-2 min-w-[160px]">
          <button
            onClick={() => toggleVoicePlay(msg)}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${isSent ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}
          >
            {playingId === msg.id ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-xs ${isSent ? 'text-emerald-100' : 'text-gray-500'}`}>{msg.attachment_name ?? 'Voice message'}</p>
            <div className={`mt-1 h-1.5 rounded-full ${isSent ? 'bg-white/30' : 'bg-gray-200'}`}>
              <div className={`h-full rounded-full ${isSent ? 'bg-white/60' : 'bg-emerald-400'}`} style={{ width: playingId === msg.id ? '60%' : '20%' }} />
            </div>
          </div>
        </div>
      );
    }

    if (msg.attachment_url) {
      return (
        <button
          onClick={() => handleDownload(msg)}
          className={`flex items-center gap-2.5 min-w-[200px] p-2 rounded-lg transition-colors ${isSent ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-50 hover:bg-gray-100'}`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isSent ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
            {getFileIcon(msg.attachment_name ?? '')}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className={`text-sm font-medium truncate ${isSent ? 'text-white' : 'text-gray-700'}`}>{msg.attachment_name ?? 'Document'}</p>
            <p className={`text-[10px] flex items-center gap-1 ${isSent ? 'text-emerald-100' : 'text-gray-400'}`}>
              <Download size={10} /> Click to download
            </p>
          </div>
        </button>
      );
    }

    return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
  }

  function canEditOrDelete(msg: Message): boolean {
    return msg.sender_id === profile?.id && !msg.is_deleted_for_everyone;
  }

  function renderMessageActions(msg: Message, isSent: boolean) {
    if (!canEditOrDelete(msg)) return null;

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          openContextMenu(msg, rect.left, rect.bottom + 4);
        }}
        onTouchStart={(e) => handleTouchStart(e, msg)}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => handleContextMenu(e, msg)}
        className={`absolute top-1 ${isSent ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full ${
          isSent ? 'bg-emerald-700/50 text-emerald-100 hover:bg-emerald-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
        }`}
        title="Message actions"
      >
        <MoreVertical size={14} />
      </button>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="sm:hidden">
        <h1 className="text-2xl font-bold text-gray-800">Chat</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden h-[calc(100vh-180px)] flex">
        {/* Conversation list */}
        <div className={`w-full sm:w-72 border-r border-gray-100 flex flex-col ${activePartnerId ? 'hidden sm:flex' : 'flex'}`}>
          <div className="p-3 border-b border-gray-100 bg-slate-50/50">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." icon={<Search size={16} />} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvos.length === 0 ? (
              <EmptyState icon={<MessageSquare size={36} />} title="No conversations" message="Accepted learning requests will appear here." />
            ) : (
              filteredConvos.map((c) => {
                const initials = c.partner.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <button
                    key={c.partner.id}
                    onClick={() => setActivePartnerId(c.partner.id)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${activePartnerId === c.partner.id ? 'bg-emerald-50' : ''}`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.partner.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.lastMessage}</p>
                    </div>
                    {c.lastTime && (
                      <span className="text-[10px] text-gray-300 shrink-0">
                        {new Date(c.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat area */}
        {activeConvo ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-slate-50/50">
              <button onClick={() => setActivePartnerId(null)} className="sm:hidden p-1 text-gray-500">
                <ArrowLeft size={20} />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-semibold">
                {activeConvo.partner.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{activeConvo.partner.full_name}</p>
                <p className="text-xs text-gray-400">{activeConvo.partner.department}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#e5ddd5]/30">
              {activeConvo.messages.length === 0 ? (
                <EmptyState icon={<MessageSquare size={36} />} title="No messages yet" message="Send the first message to start the conversation." />
              ) : (
                activeConvo.messages.map((msg) => {
                  const isSent = msg.sender_id === profile?.id;
                  const isEditing = editingMsgId === msg.id;
                  return (
                    <div
                      key={msg.id}
                      className={`group relative flex ${isSent ? 'justify-end' : 'justify-start'}`}
                      onContextMenu={(e) => canEditOrDelete(msg) ? handleContextMenu(e, msg) : undefined}
                      onTouchStart={(e) => canEditOrDelete(msg) ? handleTouchStart(e, msg) : undefined}
                      onTouchEnd={handleTouchEnd}
                    >
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm relative ${isSent ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none border border-gray-100'}`}>
                        {renderMessageActions(msg, isSent)}

                        {isEditing ? (
                          <div className="min-w-[240px]">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className={`w-full rounded-lg p-2 text-sm resize-none border ${isSent ? 'bg-white text-gray-800 border-gray-200' : 'bg-white text-gray-800 border-gray-200'} focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => saveEdit(msg)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                              >
                                <Check size={14} /> Save
                              </button>
                              <button
                                onClick={() => setEditingMsgId(null)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-300"
                              >
                                <X size={14} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {renderMessageContent(msg, isSent)}
                            <div className="flex items-center justify-end gap-1 mt-1">
                              {msg.is_edited && !msg.is_deleted_for_everyone && (
                                <span className={`text-[10px] italic ${isSent ? 'text-emerald-200' : 'text-gray-400'}`}>
                                  edited
                                </span>
                              )}
                              <p className={`text-[10px] ${isSent ? 'text-emerald-100' : 'text-gray-400'} text-right`}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pending session invitation preview */}
            {pendingShare && pendingShare.targetUserId === activePartnerId && (
              <div className="p-3 border-t border-emerald-200 bg-emerald-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <Video size={14} /> Session Invitation Preview
                  </span>
                  <button
                    onClick={() => setPendingShare(null)}
                    className="p-1 rounded text-gray-400 hover:bg-gray-100"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="bg-white rounded-lg p-3 border border-emerald-100">
                  <p className="text-sm font-semibold text-gray-800">{pendingShare.invitation.skill_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><CalendarDays size={12} /> {pendingShare.invitation.session_date}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {pendingShare.invitation.session_time}</span>
                  </div>
                  {pendingShare.invitation.meeting_url ? (
                    <p className="text-xs text-emerald-600 mt-1 truncate">{pendingShare.invitation.meeting_url}</p>
                  ) : (
                    <p className="text-xs text-red-500 mt-1">No meeting URL available</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setPendingShare(null)}
                    className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendInvitation}
                    disabled={sending || !pendingShare.invitation.meeting_url}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={15} /> {sending ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </div>
            )}

            {/* Recording bar or input */}
            {isRecording ? (
              <div className="p-3 border-t border-gray-100 flex items-center gap-3 bg-red-50">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm text-red-600 font-medium flex-1">
                  Recording... {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
                <button
                  onClick={() => stopRecording(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => stopRecording(true)}
                  className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            ) : (
              !pendingShare && (
                <div className="p-3 border-t border-gray-100 flex items-center gap-2 bg-slate-50/50">
                  <button
                    onClick={handleFileClick}
                    disabled={isBusy}
                    className="w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors disabled:opacity-50 shrink-0"
                    title="Attach document"
                  >
                    {uploadingFile ? <div className="w-4 h-4 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin" /> : <Paperclip size={20} />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={startRecording}
                    disabled={isBusy}
                    className="w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors disabled:opacity-50 shrink-0"
                    title="Record voice message"
                  >
                    {uploadingVoice ? <div className="w-4 h-4 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin" /> : <Mic size={20} />}
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    disabled={isBusy}
                    className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 bg-white"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send size={18} />
                  </button>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="hidden sm:flex flex-1 items-center justify-center bg-slate-50/50">
            <EmptyState icon={<MessageSquare size={48} />} title="Select a conversation" message="Choose a chat from the list to start messaging." />
          </div>
        )}
      </div>

      {/* Context menu (floating) */}
      {contextMenuMsg && contextMenuPos && (
        <div
          className="fixed z-[60] bg-white rounded-lg shadow-xl border border-gray-100 py-1 min-w-[180px] animate-fadeIn"
          style={{ left: Math.min(contextMenuPos.x, window.innerWidth - 200), top: Math.min(contextMenuPos.y, window.innerHeight - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          {canEditOrDelete(contextMenuMsg) && (
            <>
              <button
                onClick={() => startEdit(contextMenuMsg)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <Pencil size={15} /> Edit
              </button>
              <button
                onClick={() => {
                  setConfirmDeleteMsg(contextMenuMsg);
                  setDeleteTarget('me');
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <Trash2 size={15} /> Delete for me
              </button>
              {contextMenuMsg.sender_id === profile?.id && (
                <button
                  onClick={() => {
                    setConfirmDeleteMsg(contextMenuMsg);
                    setDeleteTarget('everyone');
                    closeContextMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <Trash2 size={15} /> Delete for everyone
                </button>
              )}
            </>
          )}
          {!canEditOrDelete(contextMenuMsg) && (
            <button
              onClick={() => {
                setConfirmDeleteMsg(contextMenuMsg);
                setDeleteTarget('me');
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
            >
              <Trash2 size={15} /> Delete for me
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteMsg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => { setConfirmDeleteMsg(null); setDeleteTarget(null); }} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-slideUp">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <Trash2 size={20} />
              </div>
              <h3 className="text-base font-semibold text-gray-800">
                {deleteTarget === 'everyone' ? 'Delete for everyone?' : 'Delete for me?'}
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              {deleteTarget === 'everyone'
                ? 'This message will be removed for both you and the other participant. This cannot be undone.'
                : 'This message will be hidden from your chat only. It will remain visible to the other participant.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setConfirmDeleteMsg(null); setDeleteTarget(null); }}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteTarget === 'everyone') handleDeleteForEveryone(confirmDeleteMsg);
                  else handleDeleteForMe(confirmDeleteMsg);
                }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
