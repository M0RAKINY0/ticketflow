import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import QRCode from "qrcode";

import { env } from "../config/env.js";
import { AppError } from "../shared/errors.js";

const PUBLIC_ID_BYTES = 32;
const SIGNATURE_HEX_LENGTH = 64;

export function createTicketPublicId(): string {
  return randomBytes(PUBLIC_ID_BYTES).toString("base64url");
}

export function createTicketQrPayload(publicId: string): string {
  return `${publicId}.${sign(publicId)}`;
}

export async function createTicketQrDataUrl(publicId: string): Promise<string> {
  return QRCode.toDataURL(createTicketQrPayload(publicId), {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "image/png",
    width: 320,
  });
}

export function verifyTicketQrPayload(payload: string): string {
  const separator = payload.lastIndexOf(".");

  if (separator <= 0 || separator === payload.length - 1) {
    throw invalidQrPayload();
  }

  const publicId = payload.slice(0, separator);
  const suppliedSignature = payload.slice(separator + 1);

  if (
    !/^[A-Za-z0-9_-]{43}$/.test(publicId) ||
    !new RegExp(`^[a-f0-9]{${SIGNATURE_HEX_LENGTH}}$`).test(suppliedSignature)
  ) {
    throw invalidQrPayload();
  }

  const expected = Buffer.from(sign(publicId), "hex");
  const supplied = Buffer.from(suppliedSignature, "hex");

  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw invalidQrPayload();
  }

  return publicId;
}

function sign(publicId: string): string {
  return createHmac("sha256", env.TICKET_QR_SECRET)
    .update(publicId)
    .digest("hex");
}

function invalidQrPayload(): AppError {
  return new AppError(400, "INVALID_QR_PAYLOAD", "QR payload is invalid");
}
