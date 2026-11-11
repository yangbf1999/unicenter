-- Rebrand leftover: live DBs that applied MSP alpha1 while Connection.type was still 'pve'
-- keep trigger bodies checking type='pve'. After the app switched to 'unisphere', inserting
-- a provider_connections row fails with:
--   Cannot add non-PVE connection % (type=unisphere) to provider_connections
-- Replace both pool-sync functions with the unisphere-aware bodies.

CREATE OR REPLACE FUNCTION enforce_connection_pool_sync_from_connection()
RETURNS TRIGGER AS $$
DECLARE pool_row_exists BOOLEAN;
BEGIN
  PERFORM set_config('search_path', TG_TABLE_SCHEMA || ', pg_catalog', true);
  IF NEW.type <> 'unisphere' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('connection:' || NEW.id));
  SELECT EXISTS (SELECT 1 FROM "provider_connections" WHERE connection_id = NEW.id) INTO pool_row_exists;
  IF NEW.tenant_id = 'default' AND NOT pool_row_exists THEN
    RAISE EXCEPTION 'UNISPHERE Connection % has tenant_id=default but no provider_connections row', NEW.id;
  END IF;
  IF NEW.tenant_id <> 'default' AND pool_row_exists THEN
    RAISE EXCEPTION 'UNISPHERE Connection % has tenant_id=% but is still in provider_connections', NEW.id, NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_connection_pool_sync_from_pool()
RETURNS TRIGGER AS $$
DECLARE conn_id TEXT; conn_tenant TEXT; conn_type TEXT; pool_row_exists BOOLEAN;
BEGIN
  PERFORM set_config('search_path', TG_TABLE_SCHEMA || ', pg_catalog', true);
  conn_id := COALESCE(NEW.connection_id, OLD.connection_id);
  PERFORM pg_advisory_xact_lock(hashtext('connection:' || conn_id));
  SELECT tenant_id, type INTO conn_tenant, conn_type FROM "Connection" WHERE id = conn_id;
  IF conn_tenant IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF conn_type <> 'unisphere' AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Cannot add non-UNISPHERE connection % (type=%) to provider_connections', conn_id, conn_type;
  END IF;
  SELECT EXISTS (SELECT 1 FROM "provider_connections" WHERE connection_id = conn_id) INTO pool_row_exists;
  IF conn_type = 'unisphere' AND conn_tenant = 'default' AND NOT pool_row_exists THEN
    RAISE EXCEPTION 'UNISPHERE Connection % has tenant_id=default but provider_connections row was removed', conn_id;
  END IF;
  IF conn_tenant <> 'default' AND pool_row_exists THEN
    RAISE EXCEPTION 'Connection % has tenant_id=% but a provider_connections row exists', conn_id, conn_tenant;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Align column default with schema (was 'pve' on older volumes).
ALTER TABLE "Connection" ALTER COLUMN type SET DEFAULT 'unisphere';
