import type { Role } from "../../src/generated/prisma/client.js";
import { auth } from "../../src/infrastructure/auth.js";

export async function issueTestJwt(user: {
  id: string;
  role: Role;
}): Promise<string> {
  const result = await auth.api.signJWT({
    body: { payload: { sub: user.id, role: user.role } },
  });
  return result.token;
}
