DROP TABLE "RefreshToken";

ALTER TABLE "User"
  DROP COLUMN "passwordHash",
  ALTER COLUMN "phoneNumber" DROP NOT NULL,
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "image" TEXT;

CREATE TABLE "Session" (
  "id" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" UUID NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
  "id" UUID NOT NULL,
  "issuer" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ(3),
  "refreshTokenExpiresAt" TIMESTAMPTZ(3),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Verification" (
  "id" UUID NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Jwks" (
  "id" UUID NOT NULL,
  "publicKey" TEXT NOT NULL,
  "privateKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3),
  "alg" TEXT,
  "crv" TEXT,
  CONSTRAINT "Jwks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX "Account_issuer_accountId_key" ON "Account"("issuer", "accountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
