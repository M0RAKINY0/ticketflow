import { AppError } from "../shared/errors.js";
type TurnstileConfig = {
  secret: string | undefined;
  hostnames: string[];
  production: boolean;
};
export async function verifyTurnstile(
  token: string | undefined,
  config: TurnstileConfig,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!config.secret) {
    if (config.production)
      throw new AppError(
        503,
        "BOT_PROTECTION_UNAVAILABLE",
        "Checkout protection is not configured",
      );
    return;
  }
  if (!token || token.length > 2048)
    throw new AppError(
      400,
      "BOT_VERIFICATION_FAILED",
      "Complete the checkout verification",
    );
  let result: { success?: boolean; hostname?: string; action?: string };
  try {
    const response = await fetcher(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: config.secret, response: token }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error("Siteverify unavailable");
    result = (await response.json()) as typeof result;
  } catch {
    throw new AppError(
      503,
      "BOT_PROTECTION_UNAVAILABLE",
      "Checkout verification is unavailable. Try again.",
    );
  }
  if (
    result?.success !== true ||
    !result.hostname ||
    !config.hostnames.includes(result.hostname) ||
    result.action !== "checkout"
  )
    throw new AppError(
      400,
      "BOT_VERIFICATION_FAILED",
      "Checkout verification failed. Try again.",
    );
}
