import { enqueueAccountEmail } from "../../infrastructure/auth.js";
import { allowRecoveryEmail } from "../../infrastructure/redis.js";
import { rotateReservationAccess } from "./ticketing.service.js";

type Principal = Parameters<typeof rotateReservationAccess>[2];

export async function recoverTickets(email: string) {
  if (await allowRecoveryEmail(email))
    await enqueueAccountEmail({ kind: "ticket-recovery", email });
}

/**
 * Kills every existing link to the reservation, then emails fresh links to
 * the buyer. The email shares the recovery throttle, so a throttled reset
 * still kills the old links and the buyer can recover again later.
 */
export async function resetReservationLink(
  reservationId: string,
  accessToken: string | undefined,
  principal?: Principal,
) {
  const buyerEmail = await rotateReservationAccess(
    reservationId,
    accessToken,
    principal,
  );
  await recoverTickets(buyerEmail);
}
