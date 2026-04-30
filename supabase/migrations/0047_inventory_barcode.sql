-- Add barcode field to inventory for scanner lookup and receiving flow
alter table inventory
  add column if not exists barcode text;

create index if not exists inventory_barcode_idx
  on inventory(team_id, barcode)
  where barcode is not null;
