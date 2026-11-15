import { enqueueAccountEmail } from "../../infrastructure/auth.js";
import { allowRecoveryEmail } from "../../infrastructure/redis.js";
export async function recoverTickets(email: string) {
  if (await allowRecoveryEmail(email))
    await enqueueAccountEmail({ kind: "ticket-recovery", email });
}
