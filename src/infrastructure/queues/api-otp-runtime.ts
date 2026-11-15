import { env } from "../../config/env.js";
import {
  createOtpProducer,
  type VerificationOtpProducer,
} from "../../modules/notifications/otp.producer.js";
import { createQueueProducerConnection } from "./connections.js";
import { createEmailQueues } from "./email-queues.js";

import {
  createNotificationProducer,
  type NotificationProducer,
} from "../../modules/notifications/account-email.js";

type AuthEmailQueue = Parameters<typeof createOtpProducer>[0];

type OtpQueueResources = {
  authEmailQueue: AuthEmailQueue;
  close(): Promise<void>;
};

type ApiOtpRuntimeOptions = {
  url?: string;
  secret?: string;
  createConnection?: typeof createQueueProducerConnection;
  createQueues?: (
    connection: ReturnType<typeof createQueueProducerConnection>,
  ) => OtpQueueResources;
};

export type ApiOtpRuntime = {
  otpProducer: VerificationOtpProducer;
  notificationProducer: NotificationProducer;
  close(): Promise<void>;
};

export function createApiOtpRuntime(
  options: ApiOtpRuntimeOptions = {},
): ApiOtpRuntime {
  const connection = (
    options.createConnection ?? createQueueProducerConnection
  )(options.url ?? env.REDIS_URL);
  const queues = (options.createQueues ?? createEmailQueues)(connection);

  return {
    otpProducer: createOtpProducer(
      queues.authEmailQueue,
      options.secret ?? env.BETTER_AUTH_SECRET,
    ),
    notificationProducer: createNotificationProducer(
      queues.authEmailQueue,
      options.secret ?? env.BETTER_AUTH_SECRET,
    ),
    close: () => queues.close(),
  };
}
