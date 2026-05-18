-- Marketing tracking helper functions
-- Called by service_role only from the tracking API

CREATE OR REPLACE FUNCTION public.increment_campaign_open(campaign_id_arg uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.marketing_campaigns
  SET open_count = open_count + 1
  WHERE id = campaign_id_arg;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_click(campaign_id_arg uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.marketing_campaigns
  SET click_count = click_count + 1
  WHERE id = campaign_id_arg;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_revenue(campaign_id_arg uuid, revenue_arg decimal)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.marketing_campaigns
  SET conversion_revenue = conversion_revenue + revenue_arg
  WHERE id = campaign_id_arg;
$$;

-- Only service_role can call these (they use SECURITY DEFINER)
REVOKE ALL ON FUNCTION public.increment_campaign_open(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_campaign_click(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_campaign_revenue(uuid, decimal) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_open(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_campaign_click(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_campaign_revenue(uuid, decimal) TO service_role;
