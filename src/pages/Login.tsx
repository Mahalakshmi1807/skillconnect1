import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, GraduationCap, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      toast('success', 'Welcome back!');
      navigate('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-emerald-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <GraduationCap size={28} />
            </div>
            <span className="text-2xl font-bold">SkillConnect</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Exchange skills.<br />Grow together.
          </h1>
          <p className="text-emerald-100 text-lg leading-relaxed max-w-md">
            Connect with skilled students, share your expertise, learn new skills,
            and grow together — all in one place.
          </p>
          <div className="mt-12 space-y-4">
            {['Browse skills from students across departments', 'Chat and schedule learning sessions', 'Track your learning day by day'].map((t) => (
              <div key={t} className="flex items-center gap-3 text-emerald-50">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <ArrowRight size={14} />
                </div>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <GraduationCap size={22} />
            </div>
            <span className="text-xl font-bold text-gray-800">SkillConnect</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome back</h2>
          <p className="text-gray-500 mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              required
              icon={<Mail size={18} />}
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              icon={<Lock size={18} />}
            />

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-600 font-medium hover:text-emerald-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
