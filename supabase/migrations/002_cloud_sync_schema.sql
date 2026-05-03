-- ============================================================
-- Cloud sync E2EE — Alpha Terminal
-- ============================================================
-- Stocke les backups chiffrés bout-en-bout (AES-GCM 256 + PBKDF2).
-- Le serveur ne peut PAS lire le contenu : il ne voit que des bytes opaques.
-- La passphrase de déchiffrement reste exclusivement côté client.
-- ============================================================

CREATE TABLE IF NOT EXISTS cloud_backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  encrypted_payload BYTEA NOT NULL,         -- ciphertext AES-GCM (binaire opaque)
  iv BYTEA NOT NULL,                        -- nonce AES-GCM (12 bytes)
  salt BYTEA NOT NULL,                      -- salt PBKDF2 (16 bytes)
  schema_version INTEGER NOT NULL,          -- version du schéma backup (cf. backup.js)
  payload_size INTEGER NOT NULL,            -- taille du blob chiffré (info UI)
  device_label TEXT,                        -- ex: "iPhone d'Axel" — non sensible, juste pour distinguer
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_backups_user_date ON cloud_backups(user_id, created_at DESC);

-- ============================================================
-- Row Level Security : un user ne voit QUE ses propres backups
-- ============================================================
ALTER TABLE cloud_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON cloud_backups;
CREATE POLICY "users_select_own" ON cloud_backups
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own" ON cloud_backups;
CREATE POLICY "users_insert_own" ON cloud_backups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own" ON cloud_backups;
CREATE POLICY "users_delete_own" ON cloud_backups
  FOR DELETE USING (auth.uid() = user_id);

-- Pas de policy UPDATE : les backups sont immutables (append-only).
-- Pour modifier, le user push un nouveau backup et le trigger purge l'ancien.

-- ============================================================
-- Auto-purge : conserve max 20 backups par user (les plus récents)
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_cloud_backup_limit() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cloud_backups
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM cloud_backups
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 20
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_cloud_backup_limit ON cloud_backups;
CREATE TRIGGER trg_enforce_cloud_backup_limit
  AFTER INSERT ON cloud_backups
  FOR EACH ROW EXECUTE FUNCTION enforce_cloud_backup_limit();
