-- Add headers + text_body to email_send_queue so the queue worker can preserve
-- RFC 8058 List-Unsubscribe one-click headers and plain-text alternative bodies
-- that were dropped during the initial sendEmail refactor.

BEGIN;

ALTER TABLE email_send_queue
  ADD COLUMN IF NOT EXISTS headers jsonb,
  ADD COLUMN IF NOT EXISTS text_body text;

COMMIT;
