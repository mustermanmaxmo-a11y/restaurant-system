-- Editor-Studio Phase 1: Entwurf/Veröffentlichen-Fundament
-- Entwurf des Editors (Marke + Landing-Inhalt) getrennt vom Live-Zustand.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS draft_config jsonb,
  ADD COLUMN IF NOT EXISTS last_published_at timestamptz;

COMMENT ON COLUMN restaurants.draft_config IS 'Editor-Entwurf (brand + landing_content + draft_updated_at). NULL = noch kein Entwurf, Editor initialisiert aus Live-Stand.';
COMMENT ON COLUMN restaurants.last_published_at IS 'Zeitpunkt des letzten Veröffentlichens (Entwurf→Live). Vergleich mit draft.draft_updated_at ergibt "nicht veröffentlichte Änderungen".';
