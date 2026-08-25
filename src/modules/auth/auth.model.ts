import type { Role } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/prisma.js";

type CreateUserInput = {
  email: string;
  name: string;
  phoneNumber: string;
  passwordHash: string;
  role: Role;
};

export const authModel = {
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
