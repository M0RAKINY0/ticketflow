import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { prisma } from "../../src/infrastructure/prisma.js";
import { eventSlugSchema } from "../../src/modules/ticketing/ticketing.schema.js";
describe("storefront migration", () => {
  it("backfills valid unique slugs when truncation lands on a separator", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'CREATE TEMP TABLE "Event" ("id" UUID, "title" TEXT) ON COMMIT DROP',
      );
      await tx.$executeRawUnsafe(
        'CREATE TEMP TABLE "TicketType" ("id" UUID, "price" DECIMAL(12,2)) ON COMMIT DROP',
      );
      await tx.$executeRawUnsafe(
        'CREATE TEMP TABLE "Ticket" ("ticketTypeId" UUID) ON COMMIT DROP',
      );
      for (const title of ["a".repeat(59) + " b", "a".repeat(59) + " b", "!!!"])
        await tx.$executeRaw`INSERT INTO "Event" ("id", "title") VALUES (gen_random_uuid(), ${title})`;
      for (const file of [
        "20261115090000_storefront",
        "20261115110000_normalize_backfilled_slugs",
      ]) {
        const sql = readFileSync(
          `prisma/migrations/${file}/migration.sql`,
          "utf8",
        );
        for (const statement of sql
          .split(";")
          .filter((statement) => statement.trim()))
          await tx.$executeRawUnsafe(statement);
      }
      const events = await tx.$queryRaw<
        Array<{ slug: string }>
      >`SELECT "slug" FROM "Event"`;
      expect(events).toHaveLength(3);
      expect(
        events.every((event) => eventSlugSchema.safeParse(event.slug).success),
      ).toBe(true);
      expect(new Set(events.map((event) => event.slug)).size).toBe(3);
    });
  });
});
