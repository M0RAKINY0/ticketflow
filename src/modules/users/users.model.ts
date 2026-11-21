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

/** The root client, or a transaction client when called inside one. */
type Db = Prisma.TransactionClient;

const eventRef = { id: true, title: true } satisfies Prisma.EventSelect;

export const usersModel = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findWithSignInMethods(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { accounts: { select: { providerId: true, password: true } } },
    });
  },

  /** Upcoming published events the user hosts that have sold tickets. */
  liveHostedEvents(userId: string, now: Date, db: Db = prisma) {
    return db.event.findMany({
      where: {
        organizerId: userId,
        status: "PUBLISHED",
        endsAt: { gt: now },
        reservations: { some: { status: "CONFIRMED" } },
      },
      select: eventRef,
      orderBy: { startsAt: "asc" },
    });
  },

  /** Upcoming published events where the user's orders hold a usable ticket. */
  upcomingTicketEvents(
    owned: Prisma.ReservationWhereInput,
    now: Date,
    db: Db = prisma,
  ) {
    return db.event.findMany({
      where: {
        status: "PUBLISHED",
        endsAt: { gt: now },
        reservations: {
          some: {
            AND: [
              owned,
              { status: "CONFIRMED" },
              { tickets: { some: { status: "READY" } } },
            ],
          },
        },
      },
      select: eventRef,
      orderBy: { startsAt: "asc" },
    });
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
      deletedAt: null,
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
