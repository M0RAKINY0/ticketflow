import type { User } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors.js';
import { usersRepository } from './users.repository.js';

type AssignableRole = 'USER' | 'ORGANIZER';
type PublicUser = Omit<User, 'passwordHash'>;

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await usersRepository.findById(userId);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return toPublicUser(user);
}

export async function assignRole(userId: string, role: AssignableRole): Promise<PublicUser> {
  const user = await usersRepository.findById(userId);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return toPublicUser(await usersRepository.updateRole(userId, role));
}
