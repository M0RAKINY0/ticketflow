import { prisma } from '../../infrastructure/prisma.js';
import type { Role } from '../../generated/prisma/client.js';

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  updateRole(id: string, role: Role) {
    return prisma.user.update({ where: { id }, data: { role } });
  },
};
