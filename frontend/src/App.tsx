import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogOut, Shield, Sparkles } from 'lucide-react';
import type { components } from './types/api';

// Types from openapi-typescript (these use PascalCase property names)
type Account = components['schemas']['Account'];
type AuthResponse = components['schemas']['AuthResponse'];
type SignupRequest = components['schemas']['SignupRequest'];
type SigninRequest = components['schemas']['SigninRequest'];

export default function AuthApp() {
  const [view, setView] = useState<'signin' | 'signup' | 'dashboard'>('signin');
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // keep state variables lowercase (idiomatic), map to PascalCase when sending
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async (): Promise<void> => {
    try {
      const response = await fetch('/api/me', { credentials: 'include' });
      if (response.ok) {
        // The backend returns Account which (per generated types) has PascalCase props
        const data: Account = await response.json();
        setUser(data);
        setView('dashboard');
      }
    } catch {
      // ignore
    }
  };

  const validateEmail = (value: string): string => {
    if (!value) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? '' : 'Please enter a valid email address';
  };

  const validatePassword = (value: string): string => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) return 'Password must contain at least one special character';
    return '';
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = e.target.value;
    setEmail(v);
    if (emailError) setEmailError(validateEmail(v));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = e.target.value;
    setPassword(v);
    if (passwordError) setPasswordError(validatePassword(v));
  };

  const handleSignup = async (): Promise<void> => {
    setError('');

    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    setEmailError(emailValidation);
    setPasswordError(passwordValidation);

    if (emailValidation || passwordValidation) return;

    setLoading(true);

    try {
      // IMPORTANT: map lowercase state -> PascalCase request shape
      const requestBody: SignupRequest = {
        Email: email,
        Password: password
      } as unknown as SignupRequest; // cast to satisfy TS if generator used literal types

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const t = await response.text();
        throw new Error(t || 'Signup failed');
      }

      setView('signin');
      setError('Account created! Please sign in.');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignin = async (): Promise<void> => {
    setError('');

    const emailValidation = validateEmail(email);
    setEmailError(emailValidation);

    if (emailValidation || !password) {
      if (!password) setPasswordError('Password is required');
      return;
    }

    setLoading(true);

    try {
      // Map to PascalCase again
      const requestBody: SigninRequest = {
        Email: email,
        Password: password
      } as unknown as SigninRequest;

      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const t = await response.text();
        throw new Error(t || 'Signin failed');
      }

      const data: AuthResponse = await response.json();
      // AuthResponse per your generated types has 'Account' property
      if (data.Account) {
        setUser(data.Account);
        setView('dashboard');
        setEmail('');
        setPassword('');
        setEmailError('');
        setPasswordError('');
      } else {
        // defensive fallback if casing differs server-side
        // try lowercase fallback
        const maybe = (data as any).account;
        if (maybe) {
          setUser(maybe);
          setView('dashboard');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signin failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignout = async (): Promise<void> => {
    setLoading(true);
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setView('signin');
    } catch {
      setError('Signout failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent): void => {
    e?.preventDefault();
    view === 'signin' ? handleSignin() : handleSignup();
  };

  const getAvatarUrl = (seed?: string): string =>
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed || 'default')}`;

  // NOTE: Access response fields using PascalCase to match generated types (Account.Email, Account.CreatedAt)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <style>{`
        @keyframes blob { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(30px,-50px) scale(1.1);} 66%{transform:translate(-20px,20px) scale(0.9);} }
        .animate-blob{ animation: blob 7s infinite; }
        .animation-delay-2000{ animation-delay: 2s; }
        .animation-delay-4000{ animation-delay: 4s; }
      `}</style>

      <div className="w-full max-w-md relative z-10">
        {view === 'dashboard' ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                {/* use PascalCase Email from Account */}
                <img
                  src={getAvatarUrl(user?.Email ?? undefined)}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full border-4 border-emerald-400 shadow-lg bg-slate-800"
                />
                <div className="absolute -bottom-1 -right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white/10"></div>
              </div>

              <Sparkles className="w-6 h-6 text-emerald-400 mb-2" />
              <h2 className="text-3xl font-bold text-white mb-1">Welcome Back!</h2>
              <p className="text-emerald-200 text-sm">You are all set</p>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 mb-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 text-emerald-300" />
                <div className="flex-1">
                  <p className="text-xs text-emerald-200 mb-1">Email</p>
                  <p className="text-lg font-semibold text-white">{user?.Email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-300" />
                <div className="flex-1">
                  <p className="text-xs text-emerald-200 mb-1">Member Since</p>
                  <p className="text-sm text-white">
                    {user?.CreatedAt &&
                      new Date(user.CreatedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSignout}
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-3 rounded-xl font-semibold hover:from-red-600 hover:to-orange-600 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="flex flex-col items-center mb-6">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-4 rounded-2xl mb-4 shadow-lg">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-1">{view === 'signin' ? 'Welcome Back' : 'Get Started'}</h1>
              <p className="text-emerald-200 text-sm">{view === 'signin' ? 'Sign in to continue' : 'Create your account'}</p>
            </div>

            <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl">
              <button
                onClick={() => { setView('signin'); setError(''); setEmailError(''); setPasswordError(''); }}
                className={`flex-1 py-2.5 rounded-lg font-semibold transition-all duration-200 ${view === 'signin' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg' : 'text-emerald-200 hover:text-white'}`}
              >
                Sign In
              </button>

              <button
                onClick={() => { setView('signup'); setError(''); setEmailError(''); setPasswordError(''); }}
                className={`flex-1 py-2.5 rounded-lg font-semibold transition-all duration-200 ${view === 'signup' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg' : 'text-emerald-200 hover:text-white'}`}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <div className={`p-4 rounded-xl mb-4 backdrop-blur ${error.includes('created') ? 'bg-green-500/20 text-green-100 border border-green-400/30' : 'bg-red-500/20 text-red-100 border border-red-400/30'}`}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-emerald-200 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-emerald-300" />
                  <input
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    required
                    className={`w-full pl-12 pr-4 py-3.5 bg-white/10 border ${emailError ? 'border-red-400' : 'border-white/20'} rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-white placeholder-emerald-300/50 backdrop-blur transition-all`}
                    placeholder="you@example.com"
                  />
                </div>
                {emailError && <p className="mt-1.5 text-sm text-red-300">{emailError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-emerald-200 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-emerald-300" />
                  <input
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    required
                    minLength={8}
                    className={`w-full pl-12 pr-4 py-3.5 bg-white/10 border ${passwordError ? 'border-red-400' : 'border-white/20'} rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-white placeholder-emerald-300/50 backdrop-blur transition-all`}
                    placeholder="••••••••"
                  />
                </div>
                {passwordError && <p className="mt-1.5 text-sm text-red-300">{passwordError}</p>}
                {view === 'signup' && !passwordError && <p className="mt-1.5 text-xs text-emerald-200/60">Must be 8+ characters with uppercase, lowercase, number, and special character</p>}
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !email || !password}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {loading ? <span className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Loading...</span> : view === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </div>

            <p className="text-center text-sm text-emerald-200/80 mt-6">
              {view === 'signin' ? (
                <>
                  Don’t have an account?{' '}
                  <button onClick={() => { setView('signup'); setError(''); setEmailError(''); setPasswordError(''); }} className="text-emerald-300 font-semibold hover:text-white transition-colors">Sign up</button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button onClick={() => { setView('signin'); setError(''); setEmailError(''); setPasswordError(''); }} className="text-emerald-300 font-semibold hover:text-white transition-colors">Sign in</button>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}