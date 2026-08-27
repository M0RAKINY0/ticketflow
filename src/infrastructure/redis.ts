import { redisStorage } from "@better-auth/redis-storage";
import { Redis } from "ioredis";
import { createHmac } from "node:crypto";

import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

export const redisAuthStorage = redisStorage({
  client: redis,
  keyPrefix: "ventra:auth:",
});

export async function connectRedis(): Promise<void> {
  if (redis.status === "wait") await redis.connect();
  await redis.ping();
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status !== "end") await redis.quit();
}

export async function limitVerificationEmail(email: string): Promise<void> {
  const digest = createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex");
  const key = `ventra:auth:otp-email:${digest}`;
  const count = Number(
    await redis.eval(
      'local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],ARGV[1]) end; return n',
      1,
      key,
      15 * 60,
    ),
  );
  if (count > 3) throw new Error("Too many verification email requests");
}
