import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Users, Send, MessageSquare,
  CalendarDays, Star, User as UserIcon,
  LogOut, GraduationCap, Menu, X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/skills', icon: BookOpen, label: 'My Skills' },
  { to: '/browse', icon: Users, label: 'Browse Students' },
  { to: '/requests', icon: Send, label: 'Requests' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/sessions', icon: CalendarDays, label: 'Sessions' },
  { to: '/feedback', icon: Star, label: 'Feedback' },
  { to: '/profile', icon: UserIcon, label: 'Profile' },
];

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const fullName = profile?.full_name ?? 'Student';
  const initials = fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const department = profile?.department ?? '';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — green background */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-gradient-to-b from-emerald-600 to-emerald-700 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/15">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0">
            <GraduationCap size={22} />
          </div>
          <div>
            <span className="text-base font-bold text-white leading-none block">SkillConnect</span>
            <span className="text-[11px] text-emerald-100">Student Skill Exchange</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-emerald-50 hover:bg-white/10'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-white/15 p-3">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{fullName}</p>
              <p className="text-xs text-emerald-200 truncate">{department}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-50 hover:bg-white/15 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <GraduationCap size={18} />
            </div>
            <span className="font-bold text-gray-800">SkillConnect</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Close button when sidebar open on mobile */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed top-4 right-4 z-50 lg:hidden p-2 rounded-lg bg-white shadow-lg"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}
