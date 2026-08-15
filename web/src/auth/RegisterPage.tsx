import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { registerSchema, type RegisterForm } from './auth-schema';
import { safeReturnTo } from './guards';
import { AuthFrame } from './LoginPage';
import { useSession } from './SessionProvider';

export function RegisterPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState('');
  const form = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { email: '', name: '', phoneNumber: '', password: '' } });
  async function submit(values: RegisterForm) {
    setServerError('');
    try { await session.register(values); void navigate(safeReturnTo(params.get('returnTo')), { replace: true }); }
    catch (error) { setServerError(error instanceof ApiError ? error.message : 'Your account could not be created.'); }
  }
  return <AuthFrame title="Create your account" copy="Your next great event starts here."><form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate><Input label="Full name" autoComplete="name" error={form.formState.errors.name?.message} {...form.register('name')} /><Input label="Email address" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} /><Input label="Phone number" type="tel" autoComplete="tel" placeholder="+234…" error={form.formState.errors.phoneNumber?.message} {...form.register('phoneNumber')} /><Input label="Password" type="password" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register('password')} />{serverError ? <p className="form-alert" role="alert">{serverError}</p> : null}<Button type="submit" size="lg" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Creating account…' : 'Create account'}</Button></form><Link className="text-link" to="/login">Already have an account? Sign in</Link></AuthFrame>;
}
