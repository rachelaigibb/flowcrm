-- Deal type ("side") becomes free text so each workspace can define its own list
-- (real estate: Buyer/Seller/…; other businesses: New business/Renewal/…). Values live in
-- sub_accounts.settings.deal_types; the column keeps existing lowercase values.
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_side_check;
