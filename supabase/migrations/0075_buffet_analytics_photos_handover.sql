-- Analytics: log every status change for historical analysis
CREATE TABLE IF NOT EXISTS buffet_refill_events (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id      uuid NOT NULL,
  menu_item_id text,
  item_name    text NOT NULL,
  event_type   text NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  created_by   uuid
);
CREATE INDEX IF NOT EXISTS buffet_refill_events_team_date
  ON buffet_refill_events (team_id, created_at);

-- Shift handover + waste log
CREATE TABLE IF NOT EXISTS buffet_shift_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     uuid NOT NULL,
  log_date    date NOT NULL,
  shift_label text,
  notes       text,
  items       jsonb DEFAULT '[]',
  created_at  timestamptz DEFAULT now() NOT NULL,
  created_by  uuid
);

-- Photo from buffet person on a live status row
ALTER TABLE buffet_live_status ADD COLUMN IF NOT EXISTS photo_url text;
