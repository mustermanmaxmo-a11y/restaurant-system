-- Add weekly report email opt-in to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS weekly_report_email boolean NOT NULL DEFAULT false;
