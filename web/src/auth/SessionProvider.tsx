import { useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authApi from '../api/auth';
import type { LoginInput, RegisterInput } from '../api/auth';
import type { PublicUser } from '../api/types';
import { SessionContext, type SessionContextValue } from './session-context';

type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: PublicUser };

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>({ status: 'loading', user: null });

  useEffect(() => {
    let active = true;
    void authApi.bootstrapSession().then(
      ({ user }) => {
        if (active) setSession({ status: 'authenticated', user });
      },
      () => {
        if (active) setSession({ status: 'anonymous', user: null });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { user } = await authApi.login(input);
    setSession({ status: 'authenticated', user });
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await authApi.register(input);
    setSession({ status: 'authenticated', user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      setSession({ status: 'anonymous', user: null });
    }
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({ ...session, login, register, logout }) as SessionContextValue,
    [login, logout, register, session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used within SessionProvider');
  return value;
}
