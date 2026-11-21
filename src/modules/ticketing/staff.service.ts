import type { Role } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors.js";
import { canManageEvent } from "./ticketing.authorization.js";
import { ticketingModel } from "./ticketing.model.js";

type Principal = { id: string; role: Role };

/** Most door teams are a handful of people. The cap stops runaway lists. */
export const MAX_EVENT_STAFF = 50;

/** Only the organizer or an admin manages who works the door. */
async function requireStaffManager(eventId: string, principal: Principal) {
  const event = await ticketingModel.findEventForStaff(eventId);
  if (!event || !canManageEvent(principal, event.organizerId)) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
  }
  return event;
}

export async function listEventStaff(eventId: string, principal: Principal) {
  await requireStaffManager(eventId, principal);
  const staff = await ticketingModel.listEventStaff(eventId);
  return staff.map(({ createdAt, user }) => ({
    userId: user.id,
    name: user.name,
    email: user.email,
    addedAt: createdAt,
  }));
}

/**
 * Adds a door helper by the email of their Ventra account. Staff can scan
 * tickets and see check-ins for this event, and nothing else.
 */
export async function addEventStaff(
  eventId: string,
  principal: Principal,
  email: string,
) {
  const event = await requireStaffManager(eventId, principal);
  if (event.status === "CANCELLED") {
    throw new AppError(
      409,
      "EVENT_LOCKED",
      "This event is cancelled, so it has no door to staff",
    );
  }

  const user = await ticketingModel.findStaffCandidate(email);
  if (!user) {
    throw new AppError(
      404,
      "STAFF_USER_NOT_FOUND",
      "No verified Ventra account uses that email. Ask them to sign up first.",
    );
  }
  if (user.id === event.organizerId) {
    throw new AppError(
      409,
      "STAFF_IS_ORGANIZER",
      "The organizer can already scan tickets",
    );
  }
  if (await ticketingModel.isEventStaff(eventId, user.id)) {
    throw new AppError(409, "ALREADY_STAFF", "They are already door staff");
  }
  if ((await ticketingModel.countEventStaff(eventId)) >= MAX_EVENT_STAFF) {
    throw new AppError(
      409,
      "STAFF_LIMIT",
      `An event can have at most ${MAX_EVENT_STAFF} door staff`,
    );
  }

  const { createdAt } = await ticketingModel.addEventStaff(
    eventId,
    user.id,
    principal.id,
  );
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    addedAt: createdAt,
  };
}

export async function removeEventStaff(
  eventId: string,
  principal: Principal,
  userId: string,
) {
  await requireStaffManager(eventId, principal);
  const { count } = await ticketingModel.removeEventStaff(eventId, userId);
  if (!count) {
    throw new AppError(404, "STAFF_NOT_FOUND", "They are not door staff");
  }
}

/** Events the caller can scan tickets for as door staff. */
export function listStaffEvents(userId: string, now = new Date()) {
  return ticketingModel.staffEvents(userId, now);
}
