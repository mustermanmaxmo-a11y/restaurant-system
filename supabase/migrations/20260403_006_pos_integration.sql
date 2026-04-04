-- POS & Terminal Integration
-- Neue Tabellen für externe Zahlungstransaktionen und POS-Verbindungen

-- Tabelle für alle externen Transaktionen (Terminal, POS-Anbieter, Bar)
CREATE TABLE IF NOT EXISTS external_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('stripe_terminal', 'sumup', 'zettle', 'square', 'cash')),
  external_id text,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'EUR',
  note text,
  paid_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Verhindert Duplikate bei Webhook-Retries (nur wenn external_id vorhanden)
  UNIQUE NULLS NOT DISTINCT (source, external_id)
);

-- Tabelle für OAuth-Verbindungen zu POS-Anbietern
CREATE TABLE IF NOT EXISTS pos_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('sumup', 'zettle', 'square')),
  access_token text NOT NULL,
  refresh_token text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, provider)
);

-- Kurzlebige OAuth-State-Tokens gegen CSRF
CREATE TABLE IF NOT EXISTS pos_oauth_states (
  state text PRIMARY KEY,
  provider text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indizes für häufige Abfragen
CREATE INDEX IF NOT EXISTS idx_external_transactions_restaurant_paid
  ON external_transactions (restaurant_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_connections_restaurant
  ON pos_connections (restaurant_id);

-- RLS aktivieren
ALTER TABLE external_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Nur Restaurant-Owner kann eigene Daten lesen/schreiben
CREATE POLICY "owner: external_transactions"
  ON external_transactions FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner: pos_connections"
  ON pos_connections FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Service-Role darf external_transactions einfügen (für Webhooks)
CREATE POLICY "service_role: insert external_transactions"
  ON external_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);
