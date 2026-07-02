-- ============================================================================
-- FlowCRM Phase 3C/3D: Deal address field for map + reporting helpers
-- ============================================================================

-- Add address and coordinates to deals for map view
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX idx_deals_coordinates ON public.deals(latitude, longitude) WHERE latitude IS NOT NULL;
