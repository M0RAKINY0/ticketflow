import type { User } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors.js';
import { hashPassword, verifyPassword } from '../../services/auth.js';
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '../../utilities/token.js';
import { authRepository } from './auth.repository.js';

type RegistrationInput = {
  email: string;
  name: string;
  phoneNumber: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type PublicUser = Omit<User, 'passwordHash'>;

export type AuthenticationResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

async function createAuthenticationResult(user: User): Promise<AuthenticationResult> {
  const refreshToken = await issueRefreshToken(user.id);

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: refreshToken.rawToken,
  };
}

export async function register(input: RegistrationInput): Promise<AuthenticationResult> {
  const existingUser = await authRepository.findUserByEmail(input.email);

  if (existingUser) {
    throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'Email is already registered');
  }

  let user: User;

  try {
    user = await authRepository.createUser({
      email: input.email,
      name: input.name,
      phoneNumber: input.phoneNumber,
      passwordHash: await hashPassword(input.password),
      role: 'USER',
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'Email is already registered');
    }

    throw error;
  }

  return createAuthenticationResult(user);
}

export async function login(input: LoginInput): Promise<AuthenticationResult> {
  const user = await authRepository.findUserByEmail(input.email);

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return createAuthenticationResult(user);
}

export async function refresh(rawToken: string): Promise<AuthenticationResult> {
  const { rawToken: refreshToken, user } = await rotateRefreshToken(rawToken);
  const fullUser = await authRepository.findUserById(user.id);

  if (!fullUser) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  return {
    user: toPublicUser(fullUser),
    accessToken: signAccessToken(user),
    refreshToken,
  };
}

export function logout(rawToken: string): Promise<void> {
  return revokeRefreshToken(rawToken);
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2002'
  );
}
