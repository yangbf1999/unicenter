-- Enterprise alert backend. Community alert tables remain unchanged.
CREATE TABLE IF NOT EXISTS "enterprise_alerts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "vdc_id" TEXT,
  "previous_alert_id" TEXT,
  "fingerprint" VARCHAR(64) NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "severity" VARCHAR(16) NOT NULL,
  "status" VARCHAR(24) NOT NULL,
  "resource" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "resource_name" TEXT,
  "message" TEXT NOT NULL,
  "current_value" DECIMAL,
  "threshold" DECIMAL,
  "unit" VARCHAR(32),
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "recovery_count" INTEGER NOT NULL DEFAULT 0,
  "event_version" BIGINT NOT NULL DEFAULT 1,
  "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMPTZ,
  "acknowledged_by" TEXT,
  "resolved_at" TIMESTAMPTZ,
  "resolved_by" TEXT,
  "notified_at" TIMESTAMPTZ,
  "deleted_at" TIMESTAMPTZ,
  "deleted_by" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enterprise_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "enterprise_alerts_previous_alert_id_fkey" FOREIGN KEY ("previous_alert_id") REFERENCES "enterprise_alerts"("id") ON DELETE SET NULL,
  CONSTRAINT "enterprise_alerts_type_check" CHECK ("type" IN ('cpu','memory','storage','node_down','vm_down','event','snapshot_stale','osd_latency','replication_rpo','replication_failed','custom')),
  CONSTRAINT "enterprise_alerts_severity_check" CHECK ("severity" IN ('info','warning','critical')),
  CONSTRAINT "enterprise_alerts_status_check" CHECK ("status" IN ('active','acknowledged','resolved')),
  CONSTRAINT "enterprise_alerts_occurrences_check" CHECK ("occurrences" > 0),
  CONSTRAINT "enterprise_alerts_recovery_count_check" CHECK ("recovery_count" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_enterprise_alerts_active_fingerprint"
  ON "enterprise_alerts"("tenant_id", "connection_id", COALESCE("vdc_id", ''), "fingerprint")
  WHERE "resolved_at" IS NULL AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "ix_enterprise_alerts_scope_page"
  ON "enterprise_alerts"("tenant_id", "connection_id", "vdc_id", "last_seen_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "ix_enterprise_alerts_scope_summary"
  ON "enterprise_alerts"("tenant_id", "connection_id", "vdc_id", "status", "severity")
  WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "enterprise_alert_events" (
  "id" TEXT NOT NULL,
  "alert_id" TEXT NOT NULL,
  "event_version" BIGINT NOT NULL,
  "event_type" VARCHAR(32) NOT NULL,
  "actor_user_id" TEXT,
  "request_id" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enterprise_alert_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "enterprise_alert_events_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "enterprise_alerts"("id") ON DELETE CASCADE,
  CONSTRAINT "enterprise_alert_events_alert_id_event_version_key" UNIQUE ("alert_id", "event_version")
);

CREATE TABLE IF NOT EXISTS "enterprise_alert_silences" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "vdc_id" TEXT,
  "fingerprint" VARCHAR(64) NOT NULL,
  "reason" TEXT,
  "silenced_by" TEXT NOT NULL,
  "silenced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "silenced_until" TIMESTAMPTZ,
  "cancelled_at" TIMESTAMPTZ,
  "cancelled_by" TEXT,
  CONSTRAINT "enterprise_alert_silences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_enterprise_alert_silences_effective"
  ON "enterprise_alert_silences"("tenant_id", "connection_id", COALESCE("vdc_id", ''), "fingerprint")
  WHERE "cancelled_at" IS NULL;

CREATE TABLE IF NOT EXISTS "enterprise_alert_thresholds" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "scope_type" VARCHAR(16) NOT NULL,
  "scope_id" TEXT NOT NULL,
  "values_json" JSONB NOT NULL,
  "config_version" BIGINT NOT NULL DEFAULT 1,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enterprise_alert_thresholds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "enterprise_alert_thresholds_scope_type_check" CHECK ("scope_type" IN ('tenant','connection','vdc')),
  CONSTRAINT "enterprise_alert_thresholds_tenant_id_scope_type_scope_id_key" UNIQUE ("tenant_id", "scope_type", "scope_id")
);

CREATE TABLE IF NOT EXISTS "enterprise_alert_rules" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "connection_id" TEXT,
  "vdc_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "category" VARCHAR(16) NOT NULL,
  "level" VARCHAR(16) NOT NULL,
  "task_types" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "pattern" TEXT,
  "exclude_pattern" TEXT,
  "node_pattern" TEXT,
  "severity" VARCHAR(16) NOT NULL,
  "notify_email" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enterprise_alert_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "enterprise_alert_rules_severity_check" CHECK ("severity" IN ('info','warning','critical'))
);

CREATE TABLE IF NOT EXISTS "enterprise_alert_notification_settings" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "scope_type" VARCHAR(16) NOT NULL,
  "scope_id" TEXT NOT NULL,
  "smtp_host" TEXT,
  "smtp_port" INTEGER NOT NULL DEFAULT 587,
  "smtp_user" TEXT,
  "smtp_password_enc" TEXT,
  "smtp_from" TEXT,
  "smtp_from_name" TEXT,
  "starttls" BOOLEAN NOT NULL DEFAULT true,
  "direct_tls" BOOLEAN NOT NULL DEFAULT false,
  "skip_verify" BOOLEAN NOT NULL DEFAULT false,
  "recipients" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "policy_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enterprise_alert_notification_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "enterprise_alert_notification_settings_scope_type_check" CHECK ("scope_type" IN ('tenant','connection','vdc')),
  CONSTRAINT "enterprise_alert_notification_settings_tenant_scope_key" UNIQUE ("tenant_id", "scope_type", "scope_id")
);

CREATE TABLE IF NOT EXISTS "enterprise_alert_notification_deliveries" (
  "id" TEXT NOT NULL,
  "alert_id" TEXT,
  "tenant_id" TEXT NOT NULL,
  "connection_id" TEXT,
  "vdc_id" TEXT,
  "event_version" BIGINT,
  "channel" VARCHAR(16) NOT NULL,
  "recipient" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "sent_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enterprise_alert_notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "enterprise_alert_notification_deliveries_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "enterprise_alerts"("id") ON DELETE SET NULL,
  CONSTRAINT "enterprise_alert_notification_deliveries_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "enterprise_alert_notification_deliveries_channel_check" CHECK ("channel" = 'email'),
  CONSTRAINT "enterprise_alert_notification_deliveries_attempt_count_check" CHECK ("attempt_count" >= 0)
);
CREATE INDEX IF NOT EXISTS "ix_enterprise_deliveries_due"
  ON "enterprise_alert_notification_deliveries"("status", "next_attempt_at")
  WHERE "status" IN ('pending','retry');

CREATE TABLE IF NOT EXISTS "enterprise_alert_collection_states" (
  "connection_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "collection_interval_seconds" INTEGER NOT NULL DEFAULT 60,
  "lease_owner" TEXT,
  "lease_until" TIMESTAMPTZ,
  "last_started_at" TIMESTAMPTZ,
  "last_success_at" TIMESTAMPTZ,
  "last_error" TEXT,
  "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enterprise_alert_collection_states_pkey" PRIMARY KEY ("connection_id"),
  CONSTRAINT "enterprise_alert_collection_interval_check" CHECK ("collection_interval_seconds" BETWEEN 30 AND 300),
  CONSTRAINT "enterprise_alert_collection_failures_check" CHECK ("consecutive_failures" >= 0)
);

INSERT INTO "enterprise_alert_thresholds"
  ("id", "tenant_id", "scope_type", "scope_id", "values_json", "config_version", "updated_by")
SELECT
  'eat_' || md5(t."id"), t."id", 'tenant', t."id",
  '{"cpu_warning":80,"cpu_critical":90,"memory_warning":80,"memory_critical":90,"storage_warning":80,"storage_critical":90,"snapshot_max_age_days":7,"recovery_margin":5,"recovery_confirmations":3,"osd_latency_warning":20,"osd_latency_critical":50,"replication_rpo_grace_percent":20,"replication_failure_alerts":1}'::jsonb,
  1, 'migration'
FROM "tenants" t
ON CONFLICT ("tenant_id", "scope_type", "scope_id") DO NOTHING;

INSERT INTO "enterprise_alert_collection_states" ("connection_id", "tenant_id")
SELECT "id", "tenant_id" FROM "Connection" WHERE "type" IN ('unisphere','pbs')
ON CONFLICT ("connection_id") DO NOTHING;
