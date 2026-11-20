-- Guest reservation links sign this number. Raising it kills every older link.
ALTER TABLE "Reservation" ADD COLUMN "accessVersion" INTEGER NOT NULL DEFAULT 1;
