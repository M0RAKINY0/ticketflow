import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { loginSchema, type LoginForm } from './auth-schema';
import { safeReturnTo } from './guards';
import { useSession } from './SessionProvider';

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState('');
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  async function submit(values: LoginForm) {
    setServerError('');
    try { await session.login(values); void navigate(safeReturnTo(params.get('returnTo')), { replace: true }); }
    catch (error) { setServerError(error instanceof ApiError ? error.message : 'Sign in could not be completed.'); }
  }
  return <AuthFrame title="Welcome back" copy="Sign in to see your tickets and events."><form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate><Input label="Email address" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} /><Input label="Password" type="password" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register('password')} />{serverError ? <p className="form-alert" role="alert">{serverError}</p> : null}<Button type="submit" size="lg" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}</Button></form><Link className="text-link" to="/register">New to Ventra? Create an account</Link></AuthFrame>;
}

export function AuthFrame({ children, copy, title }: { children: React.ReactNode; copy: string; title: string }) {
  return <main className="auth-page"><section className="auth-card"><Link className="wordmark auth-card__mark" to="/" aria-label="Ventra home">Ventra<span>.</span></Link><h1>{title}</h1><p>{copy}</p>{children}</section></main>;
}
