import { z } from 'zod';

const dateTime = z.iso.datetime({ offset: true });
const money = z.coerce.number().finite().min(0).max(999_999_999.99);

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
  })
  .refine((event) => new Date(event.endsAt) > new Date(event.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(10_000).optional(),
    startsAt: dateTime.optional(),
    endsAt: dateTime.optional(),
    venue: z.string().trim().min(1).max(300).optional(),
  })
  .refine((event) => Object.keys(event).length > 0, {
    message: 'At least one event field is required',
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
    message: 'At least one ticket type field is required',
  });

export const createReservationSchema = z.object({ ticketTypeId: z.uuid() });
export const idempotencyKeySchema = z.string().trim().min(1).max(200);
export const createCheckInSchema = z.object({
  qrPayload: z.string().trim().min(1).max(300),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;
