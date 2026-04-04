-- KI-Integration: Restaurant-eigener Anthropic API Key (BYOK)
-- Pro-Plan: Restaurant trägt eigenen Key ein
-- Enterprise-Plan: Plattform-Key wird genutzt (kein Feld nötig)

alter table public.restaurants
  add column if not exists anthropic_api_key text;

-- Sicherheitshinweis: Der Key wird server-seitig via Service Role gelesen.
-- Das Frontend erhält dieses Feld NIEMALS zurück (API-Routes filtern es raus).
-- Supabase verschlüsselt alle Daten at-rest (AES-256).
