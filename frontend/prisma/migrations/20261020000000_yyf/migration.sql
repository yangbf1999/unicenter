-- Logical clusters under a datacenter
CREATE TABLE IF NOT EXISTS "clusters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "id_datacenter" TEXT NOT NULL,
    CONSTRAINT "clusters_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "clusters_id_datacenter_fkey"
      FOREIGN KEY ("id_datacenter") REFERENCES "datacenters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "clusters_id_datacenter_idx" ON "clusters"("id_datacenter");
-- ManagedHost ↔ datacenter / cluster
ALTER TABLE "ManagedHost" ADD COLUMN IF NOT EXISTS "id_cluster" TEXT;
ALTER TABLE "ManagedHost" ADD COLUMN IF NOT EXISTS "id_datacenter" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManagedHost_id_cluster_fkey'
  ) THEN
    ALTER TABLE "ManagedHost"
      ADD CONSTRAINT "ManagedHost_id_cluster_fkey"
      FOREIGN KEY ("id_cluster") REFERENCES "clusters"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManagedHost_id_datacenter_fkey'
  ) THEN
    ALTER TABLE "ManagedHost"
      ADD CONSTRAINT "ManagedHost_id_datacenter_fkey"
      FOREIGN KEY ("id_datacenter") REFERENCES "datacenters"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ManagedHost_id_cluster_idx" ON "ManagedHost"("id_cluster");
CREATE INDEX IF NOT EXISTS "ManagedHost_id_datacenter_idx" ON "ManagedHost"("id_datacenter");
