import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { promisify } from "node:util";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { createAuth } from "../../src/infrastructure/auth.js";
import {
  ticketEmailSender,
  verificationEmailSender,
  type TicketEmailInput,
} from "../../src/infrastructure/email.js";
import { prisma } from "../../src/infrastructure/prisma.js";
import { createApiOtpRuntime } from "../../src/infrastructure/queues/api-otp-runtime.js";
import { createQueueProducerConnection } from "../../src/infrastructure/queues/connections.js";
import { createEmailQueues } from "../../src/infrastructure/queues/email-queues.js";
import { startWorkerRuntime, type WorkerRuntime } from "../../src/worker.js";

const run = promisify(execFile);
const redisContainer = "ventra-e2e-redis";
const password = "E2e-password-123!";

let server: Server;
let worker: WorkerRuntime | undefined;
let apiOtpRuntime: ReturnType<typeof createApiOtpRuntime>;
let redisRunning = true;
const verificationCodes = new Map<string, string>();
const ticketDeliveries: TicketEmailInput[] = [];

async function waitFor<T>(read: () => Promise<T | undefined> | T | undefined) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("E2E condition timed out");
}

async function stopServer() {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function signUpAndVerify(agent: request.Agent, email: string) {
  const signup = await agent.post("/api/v1/auth/sign-up/email").send({
    email,
    name: email.startsWith("organizer") ? "E2E Organizer" : "E2E Attendee",
    password,
  });
  expect(signup.status).toBe(200);

  const otp = await waitFor(() => verificationCodes.get(email));
  const verified = await agent
    .post("/api/v1/auth/email-otp/verify-email")
    .send({ email, otp });
  expect(verified.status).toBe(200);
  verificationCodes.delete(email);
  const signedIn = await agent
    .post("/api/v1/auth/sign-in/email")
    .send({ email, password });
  expect(signedIn.status).toBe(200);
}

beforeAll(async () => {
  vi.spyOn(verificationEmailSender, "sendVerificationOtp").mockImplementation(
    async (email, otp) => {
      verificationCodes.set(email, otp);
    },
  );
  vi.spyOn(ticketEmailSender, "sendTicket").mockImplementation(
    async (input) => {
      ticketDeliveries.push(input);
    },
  );

  apiOtpRuntime = createApiOtpRuntime();
  const auth = createAuth({
    requireEmailVerification: true,
    otpProducer: apiOtpRuntime.otpProducer,
    rateLimitEnabled: false,
    limitVerificationEmail: async () => undefined,
  });
  server = await new Promise<Server>((resolve) => {
    const listeningServer = createApp(env, auth).listen(0, "127.0.0.1", () => {
      resolve(listeningServer);
    });
  });
});

afterAll(async () => {
  if (!redisRunning) {
    await run("docker", ["start", redisContainer]);
  }
  await worker?.close().catch(() => undefined);
  await apiOtpRuntime.close();
  await stopServer();
  await prisma.$disconnect();
  vi.restoreAllMocks();
});

describe("BullMQ email flow", () => {
  it("moves encrypted OTP and ticket email jobs through Redis and recovers the outbox after Redis downtime", async () => {
    const runId = randomUUID();
    const organizerEmail = `organizer-e2e-${runId}@example.com`;
    const attendeeEmail = `attendee-e2e-${runId}@example.com`;
    const organizer = request.agent(server);
    const attendee = request.agent(server);

    const organizerSignup = organizer.post("/api/v1/auth/sign-up/email").send({
      email: organizerEmail,
      name: "E2E Organizer",
      password,
    });
    expect((await organizerSignup).status).toBe(200);

    const inspectionConnection = createQueueProducerConnection(env.REDIS_URL);
    const inspectionQueues = createEmailQueues(inspectionConnection);
    const queuedOtp = await waitFor(async () => {
      const jobs = await inspectionQueues.authEmailQueue.getJobs(["waiting"]);
      return jobs[0];
    });
    const serializedOtpJob = JSON.stringify(queuedOtp.data);
    expect(serializedOtpJob).not.toContain(organizerEmail);
    expect(Object.keys(queuedOtp.data).sort()).toEqual([
      "ciphertext",
      "expiresAt",
      "iv",
      "tag",
      "version",
    ]);

    worker = await startWorkerRuntime();
    const organizerOtp = await waitFor(() =>
      verificationCodes.get(organizerEmail),
    );
    expect(serializedOtpJob).not.toContain(organizerOtp);
    const organizerVerified = await organizer
      .post("/api/v1/auth/email-otp/verify-email")
      .send({ email: organizerEmail, otp: organizerOtp });
    expect(organizerVerified.status).toBe(200);
    verificationCodes.delete(organizerEmail);
    expect(
      (
        await organizer
          .post("/api/v1/auth/sign-in/email")
          .send({ email: organizerEmail, password })
      ).status,
    ).toBe(200);
    await inspectionQueues.close();

    await signUpAndVerify(attendee, attendeeEmail);

    const event = await organizer.post("/api/v1/events").send({
      title: "BullMQ E2E Show",
      description: "End-to-end queue verification.",
      startsAt: "2032-06-01T18:00:00.000Z",
      endsAt: "2032-06-01T22:00:00.000Z",
      venue: "Civic Centre",
      category: "MUSIC",
      city: "Lagos",
      countryCode: "NG",
      currency: "NGN",
      timezone: "Africa/Lagos",
    });
    expect(event.status).toBe(201);
    const eventId = event.body.data.event.id as string;

    const ticketType = await organizer
      .post(`/api/v1/events/${eventId}/ticket-types`)
      .send({ name: "General Admission", price: 7500, capacity: 2 });
    expect(ticketType.status).toBe(201);
    const ticketTypeId = ticketType.body.data.ticketType.id as string;
    expect(
      (await organizer.post(`/api/v1/events/${eventId}/publish`)).status,
    ).toBe(200);

    await run("docker", ["stop", redisContainer]);
    redisRunning = false;

    const reservation = await attendee
      .post(`/api/v1/events/${eventId}/reservations`)
      .set("Idempotency-Key", "bullmq-e2e-reservation")
      .send({ ticketTypeId });
    expect(reservation.status).toBe(201);
    const ticketId = reservation.body.data.reservation.ticket.id as string;

    const committedBeforeRedis = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { reservation: true },
    });
    const pendingOutbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: {
        type_aggregateId: {
          type: "TICKET_EMAIL_REQUESTED",
          aggregateId: ticketId,
        },
      },
    });
    expect(committedBeforeRedis.status).toBe("READY");
    expect(committedBeforeRedis.qrCodeDataUrl).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(committedBeforeRedis.emailSentAt).toBeNull();
    expect(pendingOutbox.publishedAt).toBeNull();

    await run("docker", ["start", redisContainer]);
    redisRunning = true;

    await waitFor(async () => {
      const stored = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });
      return stored?.emailSentAt ?? undefined;
    });
    expect(ticketDeliveries).toHaveLength(1);
    expect(ticketDeliveries[0]?.ticketId).toBe(ticketId);

    const publishedOutbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: {
        type_aggregateId: {
          type: "TICKET_EMAIL_REQUESTED",
          aggregateId: ticketId,
        },
      },
    });
    expect(publishedOutbox.publishedAt).not.toBeNull();

    const jobInspectionConnection = createQueueProducerConnection(
      env.REDIS_URL,
    );
    const jobInspectionQueues = createEmailQueues(jobInspectionConnection);
    const ticketJob = await waitFor(async () => {
      const jobs = await jobInspectionQueues.ticketEmailQueue.getJobs([
        "completed",
      ]);
      return jobs.find((job) => job.id === `ticket-email-${ticketId}`);
    });
    expect(ticketJob.data).toEqual({ ticketId });
    await jobInspectionQueues.close();

    const replay = await attendee
      .post(`/api/v1/events/${eventId}/reservations`)
      .set("Idempotency-Key", "bullmq-e2e-reservation")
      .send({ ticketTypeId });
    expect(replay.status).toBe(200);

    const [reservationCount, ticketCount, outboxCount, storedType] =
      await Promise.all([
        prisma.reservation.count({
          where: { userId: committedBeforeRedis.reservation.userId },
        }),
        prisma.ticket.count({
          where: { reservationId: committedBeforeRedis.reservationId },
        }),
        prisma.outboxEvent.count({ where: { aggregateId: ticketId } }),
        prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } }),
      ]);
    expect(reservationCount).toBe(1);
    expect(ticketCount).toBe(1);
    expect(outboxCount).toBe(1);
    expect(storedType.reservedCount).toBe(1);
    expect(ticketDeliveries).toHaveLength(1);
  });
});
