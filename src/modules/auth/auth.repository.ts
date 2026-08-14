import { prisma } from '../../infrastructure/prisma.js';
import type { Role } from '../../generated/prisma/client.js';

type CreateUserInput = {
  email: string;
  name: string;
  phoneNumber: string;
  passwordHash: string;
  role: Role;
};

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  createUser(input: CreateUserInput) {
    return prisma.user.create({ data: input });
  },
};
