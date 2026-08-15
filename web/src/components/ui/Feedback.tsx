import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="feedback" role="status"><LoaderCircle className="feedback__spinner" aria-hidden="true" /><p>{label}</p></div>;
}

export function EmptyState({ action, message, title }: { action?: ReactNode; message: string; title: string }) {
  return <div className="feedback"><Inbox aria-hidden="true" /><h2>{title}</h2><p>{message}</p>{action}</div>;
}

export function ErrorState({ action, message = 'Please try again.' }: { action?: ReactNode; message?: string }) {
  return <div className="feedback" role="alert"><AlertCircle aria-hidden="true" /><h2>Something went wrong</h2><p>{message}</p>{action}</div>;
}
