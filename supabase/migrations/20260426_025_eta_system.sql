-- Staff presence tracking for ETA kitchen capacity
CREATE TABLE IF NOT EXISTS staff_presence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id        uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role            text NOT NULL,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz
);

CREATE INDEX IF NOT EXISTS staff_presence_restaurant_active
  ON staff_presence (restaurant_id)
  WHERE checked_out_at IS NULL;

-- Prep time per menu item (minutes, set by operator)
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS prep_time integer DEFAULT NULL;

-- Delivery buffer per restaurant (minutes, operator-set start value for learning)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS delivery_buffer_minutes integer NOT NULL DEFAULT 25;
