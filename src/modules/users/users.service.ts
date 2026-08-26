import type { User } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors.js";
import { usersModel } from "./users.model.js";

type AssignableRole = "USER" | "ADMIN";
type PublicUser = User;

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await usersModel.findById(userId);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  return user;
}

export async function assignRole(
  userId: string,
  role: AssignableRole,
): Promise<PublicUser> {
  const user = await usersModel.findById(userId);

  if (!user) {
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
