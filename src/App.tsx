import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { FullPageLoader } from '@/components/ui/Loading';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import AppLayout from '@/components/AppLayout';
import Dashboard from '@/pages/Dashboard';
import MySkills from '@/pages/MySkills';
import BrowseStudents from '@/pages/BrowseStudents';
import Requests from '@/pages/Requests';
import Chat from '@/pages/Chat';
import Sessions from '@/pages/Sessions';
import Feedback from '@/pages/Feedback';
import Profile from '@/pages/Profile';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/skills" element={<MySkills />} />
        <Route path="/browse" element={<BrowseStudents />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
