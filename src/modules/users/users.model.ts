import type { Prisma, Role } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/prisma.js";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phoneNumber: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const usersModel = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  updateRole(id: string, role: Role) {
    return prisma.user.update({ where: { id }, data: { role } });
  },

  async list(input: {
    query?: string | undefined;
    role?: Role | undefined;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.UserWhereInput = {
      ...(input.role ? { role: input.role } : {}),
      ...(input.query
        ? {
            OR: [
              { name: { contains: input.query, mode: "insensitive" } },
              { email: { contains: input.query, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  },
};
