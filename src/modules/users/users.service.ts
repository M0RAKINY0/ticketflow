import type { User } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors.js";
import { usersModel } from "./users.model.js";
import type { OrganizerProfileInput } from "./users.schema.js";

type AssignableRole = "USER" | "ADMIN";
type PublicUser = User;

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await usersModel.findById(userId);

  if (!user || user.deletedAt) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  return user;
}

export async function assignRole(
  userId: string,
  role: AssignableRole,
): Promise<PublicUser> {
  const user = await usersModel.findById(userId);

  if (!user || user.deletedAt) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  return usersModel.updateRole(userId, role);
}

export async function listUsers(input: {
  query?: string | undefined;
  role?: "USER" | "ADMIN" | undefined;
  page: number;
  pageSize: number;
}) {
  const { items, total } = await usersModel.list(input);

  return { items, page: input.page, pageSize: input.pageSize, total };
}

export function getOrganizerProfile(userId: string) {
  return usersModel.findOrganizerProfile(userId);
}

export function saveOrganizerProfile(
  userId: string,
  input: OrganizerProfileInput,
) {
  return usersModel.saveOrganizerProfile(userId, {
    displayName: input.displayName,
    bio: input.bio ?? null,
    logoUrl: input.logoUrl ?? null,
    instagramHandle: input.instagramHandle ?? null,
    xHandle: input.xHandle ?? null,
    supportEmail: input.supportEmail ?? null,
    supportPhone: input.supportPhone ?? null,
  });
}
