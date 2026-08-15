import { createContext } from 'react';

import type { LoginInput, RegisterInput } from '../api/auth';
import type { PublicUser } from '../api/types';

export type SessionContextValue =
  | {
      status: 'loading';
      user: null;
      login(input: LoginInput): Promise<void>;
      register(input: RegisterInput): Promise<void>;
      logout(): Promise<void>;
    }
  | {
      status: 'anonymous';
      user: null;
      login(input: LoginInput): Promise<void>;
      register(input: RegisterInput): Promise<void>;
      logout(): Promise<void>;
    }
  | {
      status: 'authenticated';
      user: PublicUser;
      login(input: LoginInput): Promise<void>;
      register(input: RegisterInput): Promise<void>;
      logout(): Promise<void>;
    };

export const SessionContext = createContext<SessionContextValue | null>(null);
