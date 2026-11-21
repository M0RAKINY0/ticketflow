import type { Prisma } from "../../generated/prisma/client.js";
import { auth } from "../../infrastructure/auth.js";
import { prisma } from "../../infrastructure/prisma.js";
import { AppError } from "../../shared/errors.js";
import { usersModel } from "./users.model.js";

/** How recently a password-less (Google) account must have signed in to delete itself. */
export const FRESH_SIGN_IN_MS = 10 * 60 * 1000;

export const DELETED_NAME = "Deleted user";

export function deletedEmail(id: string): string {
  return `deleted-${id}@deleted.invalid`;
}

type Session = { id: string; userId: string; createdAt: Date };

/**
 * Deleting an account scrubs personal details and keeps the row, so past
 * events and orders keep their records (Nigeria Data Protection Act 2023
 * allows keeping what a contract or legal record needs). Deletion waits
 * while the account hosts an upcoming event with sales or holds a ticket to
 * an upcoming event, because those contracts are still running.
 */
export async function deleteAccount(
  session: Session,
  password: string | undefined,
  now = new Date(),
): Promise<void> {
  const user = await usersModel.findWithSignInMethods(session.userId);
  if (!user || user.deletedAt) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  await confirmIdentity(user.accounts, session, password, now);

  await prisma.$transaction(async (tx) => {
    // The checks run under row locks inside the transaction, so two admins
    // deleting at once can't both pass the last-admin check, and a sale
    // can't land between the sales check and the cancel below.
    await lockAndAssertDeletable(tx, user, now);
    await tx.event.deleteMany({
      where: { organizerId: user.id, status: "DRAFT" },
    });
    // lockAndAssertDeletable guarantees these have no sales.
    await tx.event.updateMany({
      where: {
        organizerId: user.id,
        status: "PUBLISHED",
        endsAt: { gt: now },
      },
      data: { status: "CANCELLED" },
    });
    await tx.$executeRaw`
      UPDATE "Reservation"
      SET "buyerName" = ${DELETED_NAME},
          "buyerEmail" = 'deleted-' || "id" || '@deleted.invalid',
          "updatedAt" = NOW()
      WHERE "userId" = ${user.id}::uuid
         OR ("userId" IS NULL AND ${user.emailVerified} AND "buyerEmail" = ${user.email.toLowerCase()})
    `;
    await tx.organizerProfile.deleteMany({ where: { userId: user.id } });
    await tx.eventStaff.deleteMany({ where: { userId: user.id } });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: DELETED_NAME,
        email: deletedEmail(user.id),
        emailVerified: false,
        image: null,
        phoneNumber: null,
        deletedAt: now,
      },
    });
  });

  // Passwords and Google links are gone, so no new sign-in can start, and
  // the session hook in auth.ts refuses deleted users. This clears every
  // existing session, Redis copies included, and any created during the
  // scrub.
  const context = await auth.$context;
  await context.internalAdapter.deleteUserSessions(user.id);
}

/**
 * Adds a password to an account that signs in with Google only. Better
 * Auth keeps this server-side, so the API exposes it for the signed-in user.
 */
export async function addPassword(headers: Headers, newPassword: string) {
  try {
    await auth.api.setPassword({ body: { newPassword }, headers });
  } catch (error) {
    const code = (error as { body?: { code?: string } }).body?.code;
    if (code === "PASSWORD_ALREADY_SET") {
      throw new AppError(
        409,
        "PASSWORD_ALREADY_SET",
        "This account already has a password. Change it instead.",
      );
    }
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        code === "PASSWORD_TOO_SHORT"
          ? "Password is too short"
          : "Password is too long",
      );
    }
    throw error;
  }
}

async function confirmIdentity(
  accounts: Array<{ providerId: string; password: string | null }>,
  session: Session,
  password: string | undefined,
  now: Date,
) {
  const hash = accounts.find(
    (account) => account.providerId === "credential",
  )?.password;

  if (hash) {
    const context = await auth.$context;
    if (!password || !(await context.password.verify({ hash, password }))) {
      throw new AppError(401, "INVALID_PASSWORD", "Password is incorrect");
    }
    return;
  }

  if (now.getTime() - session.createdAt.getTime() > FRESH_SIGN_IN_MS) {
    throw new AppError(
      403,
      "SIGN_IN_AGAIN",
      "Sign in again, then delete your account within 10 minutes",
    );
  }
}

async function lockAndAssertDeletable(
  tx: Prisma.TransactionClient,
  user: { id: string; email: string; emailVerified: boolean; role: string },
  now: Date,
) {
  // Locking every active admin row in id order serializes admin deletions
  // without deadlocks. Everyone else locks just their own row.
  const lockedAdmins = await (user.role === "ADMIN"
    ? tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User"
        WHERE "role" = 'ADMIN' AND "deletedAt" IS NULL
        ORDER BY "id" FOR UPDATE`
    : tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`);
  if (user.role === "ADMIN" && lockedAdmins.length <= 1) {
    throw new AppError(
      409,
      "LAST_ADMIN",
      "Make someone else an admin before deleting the last admin account",
    );
  }

  // Checkout raises TicketType.reservedCount, so holding these rows blocks
  // new sales on the user's upcoming events until this transaction ends.
  await tx.$queryRaw`
    SELECT tt."id" FROM "TicketType" tt
    JOIN "Event" e ON e."id" = tt."eventId"
    WHERE e."organizerId" = ${user.id}::uuid
      AND e."status" = 'PUBLISHED'
      AND e."endsAt" > ${now}
    ORDER BY tt."id"
    FOR UPDATE OF tt`;

  const live = await usersModel.liveHostedEvents(user.id, now, tx);
  if (live.length) {
    throw new AppError(
      409,
      "ACCOUNT_HOSTS_LIVE_EVENTS",
      "Cancel your upcoming events that have sold tickets, or wait until they end",
      { events: live },
    );
  }

  const owned: Prisma.ReservationWhereInput = user.emailVerified
    ? {
        OR: [
          { userId: user.id },
          { userId: null, buyerEmail: user.email.toLowerCase() },
        ],
      }
    : { userId: user.id };
  const upcoming = await usersModel.upcomingTicketEvents(owned, now, tx);
  if (upcoming.length) {
    throw new AppError(
      409,
      "ACCOUNT_HAS_UPCOMING_TICKETS",
      "You hold tickets to upcoming events. Delete your account after they end.",
      { events: upcoming },
    );
  }
}
