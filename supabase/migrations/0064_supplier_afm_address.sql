-- Add AFM (Greek tax number) and address to suppliers table
-- AFM is used by the AI invoice scanner to auto-match / auto-create suppliers

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS afm     TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN public.suppliers.afm     IS 'Greek VAT registration number (ΑΦΜ). Used for automatic supplier matching from scanned invoices.';
COMMENT ON COLUMN public.suppliers.address IS 'Registered address of the supplier.';

-- Unique AFM per team (a given tax number should not exist twice in the same team)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_team_afm_idx
  ON public.suppliers(team_id, afm)
  WHERE afm IS NOT NULL;
