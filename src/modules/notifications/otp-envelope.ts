import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import { UnrecoverableError } from "bullmq";

import type { OtpDeliveryJob } from "../../infrastructure/queues/contracts.js";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_CONTEXT = "ventra-otp-job-v1";
const OTP_EXPIRY_MS = 4 * 60 * 1_000;

type OtpDeliveryInput = { email: string; otp: string };

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", ENCRYPTION_CONTEXT, 32));
}

export function encryptEmailDelivery(
  input: unknown,
  secret: string,
  now: Date,
  expiryMs = OTP_EXPIRY_MS,
): OtpDeliveryJob {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(input), "utf8"),
    cipher.final(),
  ]);

  return {
    version: 1,
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    expiresAt: new Date(now.getTime() + expiryMs).toISOString(),
  };
}

export function decryptEmailDelivery(
  job: OtpDeliveryJob,
  secret: string,
  now: Date,
): unknown {
  if (now.getTime() >= new Date(job.expiresAt).getTime()) {
    throw new UnrecoverableError("OTP job expired");
  }

  try {
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      deriveKey(secret),
      Buffer.from(job.iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(job.tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(job.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as unknown;

    return parsed;
  } catch {
    throw new UnrecoverableError("OTP job cannot be decrypted");
  }
}

export function encryptOtpDelivery(
  input: OtpDeliveryInput,
  secret: string,
  now: Date,
): OtpDeliveryJob {
  return encryptEmailDelivery(input, secret, now);
}
export function decryptOtpDelivery(
  job: OtpDeliveryJob,
  secret: string,
  now: Date,
): OtpDeliveryInput {
  const parsed = decryptEmailDelivery(
    job,
    secret,
    now,
  ) as OtpDeliveryInput | null;
  if (
    !parsed ||
    typeof parsed.email !== "string" ||
    typeof parsed.otp !== "string"
  )
    throw new UnrecoverableError("OTP job cannot be decrypted");
  return parsed;
}
