import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Building2, GraduationCap, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Input, Select } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'Business Administration',
  'Arts & Humanities',
  'Science',
  'Other',
];

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email || !password || !department) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    const { error: err } = await signUp(email, password, fullName, department);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      toast('success', 'Account created! Please sign in.');
      navigate('/login');
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <GraduationCap size={22} />
            </div>
            <span className="text-xl font-bold text-gray-800">SkillConnect</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">Create your account</h2>
          <p className="text-gray-500 mb-8">Join the student skill exchange community</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
              icon={<User size={18} />}
            />
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
              placeholder="At least 6 characters"
              required
              icon={<Lock size={18} />}
              showPasswordToggle
            />
            <Select
              label="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              options={DEPARTMENTS}
              required
              placeholder="Select your department"
            />

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 font-medium hover:text-emerald-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-emerald-300 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Building2 size={28} />
            </div>
            <span className="text-2xl font-bold">SkillConnect</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Start your<br />learning journey.
          </h1>
          <p className="text-emerald-100 text-lg leading-relaxed max-w-md">
            Create an account to share what you know, learn from peers,
            and build your skills portfolio with peer learning.
          </p>
          <div className="mt-12 space-y-4">
            {['Free for all college students', 'No prior experience required', 'Build a verified skill portfolio'].map((t) => (
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
    </div>
  );
}
