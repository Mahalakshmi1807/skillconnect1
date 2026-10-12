export type UserRole = 'student' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  department: string;
  bio: string;
  avatar_url: string;
  role: UserRole;
  created_at: string;
}

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  category: string;
  proficiency_level: string;
  description: string;
  learning_preference: string;
  created_at: string;
}

export interface SkillWithProfile extends Skill {
  profiles: Pick<Profile, 'full_name' | 'department'> | null;
}

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface SkillRequest {
  id: string;
  requester_id: string;
  receiver_id: string;
  skill_id: string;
  status: RequestStatus;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface RequestWithDetails extends SkillRequest {
  skills: Pick<Skill, 'name' | 'category'> | null;
  requester_profile: Pick<Profile, 'full_name' | 'department'> | null;
  receiver_profile: Pick<Profile, 'full_name' | 'department'> | null;
}

export interface SessionInvitationData {
  skill_name: string;
  session_date: string;
  session_time: string;
  meeting_url: string;
  learner_name: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  request_id: string | null;
  content: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted_for_everyone: boolean;
  deleted_for_user_ids: string[];
  message_type: string;
  session_invitation_data: SessionInvitationData | null;
}

export interface Session {
  id: string;
  request_id: string;
  skill_id: string;
  mentor_id: string;
  learner_id: string;
  session_date: string;
  session_time: string;
  mode: string;
  meeting_link: string;
  status: string;
  created_at: string;
}

export interface SessionDay {
  id: string;
  session_id: string;
  day_number: number;
  topics_text: string;
  notes: string;
  created_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  ended_at: string | null;
  created_at: string;
}

export interface SessionWithDetails extends Session {
  skills: Pick<Skill, 'name'> | null;
  mentor_profile: Pick<Profile, 'full_name'> | null;
  learner_profile: Pick<Profile, 'full_name'> | null;
  session_participants: SessionParticipant[];
}

export interface Feedback {
  id: string;
  request_id: string;
  skill_id: string;
  session_day_id: string | null;
  rater_id: string;
  ratee_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export const SKILL_CATEGORIES = [
  'Programming',
  'Design',
  'Languages',
  'Music',
  'Academics',
  'Sports',
  'Photography',
  'Cooking',
  'Business',
  'Other',
];

export const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

export const LEARNING_PREFERENCES = ['Online', 'Offline', 'Both'];
