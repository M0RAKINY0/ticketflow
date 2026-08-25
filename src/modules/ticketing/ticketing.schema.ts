import { code as getCurrency } from "currency-codes";
import countries from "i18n-iso-countries";
import { z } from "zod";

const dateTime = z.iso.datetime({ offset: true });
const money = z.coerce.number().finite().min(0).max(999_999_999.99);
const eventCategory = z.enum([
  "MUSIC",
  "BUSINESS",
  "TECHNOLOGY",
  "ARTS_CULTURE",
  "FOOD_DRINK",
  "SPORTS_FITNESS",
  "COMMUNITY",
  "EDUCATION",
  "OTHER",
]);
const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/)
  .refine(countries.isValid, "Invalid ISO 3166-1 alpha-2 country code");
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/)
  .refine(isCurrency, "Invalid ISO 4217 currency code");
const timezone = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(isTimezone, "Invalid IANA timezone");
const coverImageUrl = z
  .url()
  .max(2_000)
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Cover image URL must use HTTPS",
  );

export const eventIdParamsSchema = z.object({ eventId: z.uuid() });
export const ticketParamsSchema = z.object({ ticketId: z.uuid() });
export const ticketTypeParamsSchema = z.object({
  eventId: z.uuid(),
  ticketTypeId: z.uuid(),
});

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10_000),
    startsAt: dateTime,
    endsAt: dateTime,
    venue: z.string().trim().min(1).max(300),
    category: eventCategory,
    coverImageUrl: coverImageUrl.nullable().optional(),
    city: z.string().trim().min(1).max(200),
    countryCode,
    currency,
    timezone,
  })
  .refine((event) => new Date(event.endsAt) > new Date(event.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(10_000).optional(),
    startsAt: dateTime.optional(),
    endsAt: dateTime.optional(),
    venue: z.string().trim().min(1).max(300).optional(),
    category: eventCategory.optional(),
    coverImageUrl: coverImageUrl.nullable().optional(),
    city: z.string().trim().min(1).max(200).optional(),
    countryCode: countryCode.optional(),
    currency: currency.optional(),
    timezone: timezone.optional(),
  })
  .refine((event) => Object.keys(event).length > 0, {
    message: "At least one event field is required",
  });

export const createTicketTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2_000).nullable().optional(),
  price: money,
  capacity: z.coerce.number().int().min(1).max(10_000_000),
});

export const updateTicketTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    price: money.optional(),
    capacity: z.coerce.number().int().min(1).max(10_000_000).optional(),
  })
  .refine((ticketType) => Object.keys(ticketType).length > 0, {
    message: "At least one ticket type field is required",
  });

export const createReservationSchema = z.object({ ticketTypeId: z.uuid() });
export const idempotencyKeySchema = z.string().trim().min(1).max(200);
export const createCheckInSchema = z.object({
  qrPayload: z.string().trim().min(1).max(300),
});

export const discoveryQuerySchema = z
  .object({
    query: z.string().trim().min(1).max(200).optional(),
    category: eventCategory.optional(),
    from: dateTime.optional(),
    to: dateTime.optional(),
    countryCode: countryCode.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(({ from, to }) => !from || !to || new Date(to) >= new Date(from), {
    message: "to must not be before from",
    path: ["to"],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;
export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;

function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isCurrency(value: string): boolean {
  return getCurrency(value) !== undefined;
}
