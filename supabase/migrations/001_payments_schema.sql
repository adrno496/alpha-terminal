-- Alpha Terminal — Payments schema (paiements + accès premium uniquement)
-- AUCUNE donnée d'analyse n'est stockée ici. Les analyses, holdings, RAG,
-- transcripts restent 100% locaux (IndexedDB du navigateur).
-- Ce schéma sert UNIQUEMENT à : (1) tracer les paiements Lemonsqueezy,
-- (2) marquer les comptes premium actifs, (3) auditer les webhooks reçus.

-- ============================================================
-- Table : payments
-- Log de chaque transaction Lemonsqueezy (one row per order).
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemonsqueezy_order_id TEXT UNIQUE NOT NULL,
  lemonsqueezy_customer_id TEXT NOT NULL,
  amount_cents INT NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON payments (user_id, created_at DESC);

-- ============================================================
-- Table : premium_access
-- Une ligne par utilisateur. Lue par le frontend pour gating UI,
-- enforced server-side via RLS sur les tables sensibles (s'il y en a).
-- ============================================================
CREATE TABLE IF NOT EXISTS premium_access (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  subscription_started_at TIMESTAMP WITH TIME ZONE,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  lemonsqueezy_subscription_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_access_active
  ON premium_access (is_active, subscription_expires_at);

-- ============================================================
-- Table : audit_webhooks
-- Stocke chaque webhook reçu pour debug / replay en cas d'incident.
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_webhooks (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  webhook_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_webhooks_event_created
  ON audit_webhooks (event_type, created_at DESC);

-- ============================================================
-- Row-Level Security : un utilisateur ne voit QUE ses propres paiements
-- et son propre statut premium. La service-role key (utilisée par le
-- webhook edge function) bypass RLS donc peut tout écrire.
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_access ENABLE ROW LEVEL SECURITY;
-- audit_webhooks : pas de RLS (logs internes, jamais lus depuis le frontend)

DROP POLICY IF EXISTS "Users can read own payments" ON payments;
CREATE POLICY "Users can read own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own premium_access" ON premium_access;
CREATE POLICY "Users can read own premium_access"
  ON premium_access FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- Function : activate_premium
-- Appelée par le webhook (subscription_created / subscription_resumed).
-- UPSERT idempotent : nouveau user → INSERT, user existant → renouvelle.
-- ============================================================
CREATE OR REPLACE FUNCTION activate_premium(
  p_user_id UUID,
  p_lemonsqueezy_subscription_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO premium_access (
    user_id, is_active,
    subscription_started_at,
    subscription_expires_at,
    lemonsqueezy_subscription_id
  )
  VALUES (
    p_user_id, true,
    NOW(),
    NOW() + INTERVAL '1 month',
    p_lemonsqueezy_subscription_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    is_active = true,
    subscription_started_at = COALESCE(premium_access.subscription_started_at, NOW()),
    subscription_expires_at = NOW() + INTERVAL '1 month',
    lemonsqueezy_subscription_id = EXCLUDED.lemonsqueezy_subscription_id,
    updated_at = NOW();
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function : check_premium
-- Appelable depuis le frontend (RPC) ou en SQL pour gates server-side.
-- ============================================================
CREATE OR REPLACE FUNCTION check_premium(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM premium_access
    WHERE user_id = p_user_id
      AND is_active = true
      AND subscription_expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions explicites pour l'usage RPC depuis le frontend authentifié
GRANT EXECUTE ON FUNCTION check_premium(UUID) TO authenticated;
-- activate_premium réservée au service_role (webhook), pas exposée à authenticated
