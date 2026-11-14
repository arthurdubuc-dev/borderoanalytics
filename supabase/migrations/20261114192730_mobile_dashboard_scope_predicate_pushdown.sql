-- Keep direct array predicates visible to the planner before RLS/aggregations.
-- The authorized-date predicates remain mandatory and unchanged.
alter function public.mobile_dashboard_date_capabilities(uuid,uuid[]) rows 20;

-- One statement snapshot of the revenue inputs, still under caller RLS.
-- Financial formulas remain exclusively in the canonical Bordero Web engine.
create or replace function public.mobile_dashboard_finance_inputs(
  p_workspace_id uuid,
  p_event_date_ids uuid[]
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with capabilities as materialized (
    select * from public.mobile_dashboard_date_capabilities(p_workspace_id,p_event_date_ids)
  ), authorized as materialized (
    select c.event_date_id from capabilities c
    where c.capabilities->>'canViewBordereau' = 'true'
  ), sources as materialized (
    select c.event_date_id,c.source_type,c.gross_revenue
    from public.v_event_date_sales_current_canonical c
    where c.event_date_id = any(p_event_date_ids) and c.workspace_id = p_workspace_id
      and c.event_date_id in (select a.event_date_id from authorized a)
  ), economic as materialized (
    select e.event_date_id,e.inherited_tickets,e.continuity_state,e.revenue_visible
    from public.get_event_dates_economic_sales(
      coalesce((select array_agg(a.event_date_id) from authorized a),'{}'::uuid[])
    ) e
  )
  select jsonb_build_object(
    'capabilities',coalesce((select jsonb_agg(to_jsonb(c)) from capabilities c),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(to_jsonb(s)) from sources s),'[]'::jsonb),
    'economic',coalesce((select jsonb_agg(to_jsonb(e)) from economic e),'[]'::jsonb),
    'dates',coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'workspace_id',d.workspace_id,'project_id',d.project_id,'tour_id',d.tour_id,'date',d.date,'status',d.status,
      'vat_rate',d.vat_rate,'deal_type',d.deal_type,'cession_amount_ht',d.cession_amount_ht,'actual_attendance',d.actual_attendance,
      'dl_promoter_pct',d.dl_promoter_pct,'tax_override_enabled',d.tax_override_enabled,'tax_profile_override',d.tax_profile_override
    )) from public.event_dates d where d.id = any(p_event_date_ids) and d.workspace_id=p_workspace_id and d.id in (select a.event_date_id from authorized a)),'[]'::jsonb),
    'projects',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'workspace_id',p.workspace_id,'owner_org_id',p.owner_org_id,'vat_rate',p.vat_rate,'tax_profile',p.tax_profile
    )) from public.projects p where p.workspace_id=p_workspace_id and p.archived_at is null
       and p.id in (select d.project_id from public.event_dates d join authorized a on a.event_date_id=d.id where d.id = any(p_event_date_ids))),'[]'::jsonb),
    'sales',coalesce((select jsonb_agg(jsonb_build_object(
       'id',s.id,'event_date_id',s.event_date_id,'ticket_price_id',s.ticket_price_id,'quantity',s.quantity,'platform',s.platform
    )) from public.sales s where s.event_date_id = any(p_event_date_ids) and s.event_date_id in (select a.event_date_id from authorized a)),'[]'::jsonb),
    'prices',coalesce((select jsonb_agg(jsonb_build_object(
       'id',p.id,'event_date_id',p.event_date_id,'tariff_name',p.tariff_name,'price_ht',p.price_ht,
       'dl_producer',p.dl_producer,'dl_venue',p.dl_venue,'dl_distribution',p.dl_distribution
    )) from public.ticket_prices p where p.event_date_id = any(p_event_date_ids) and p.event_date_id in (select a.event_date_id from authorized a)),'[]'::jsonb),
    'taxes',coalesce((select jsonb_agg(jsonb_build_object(
       'event_date_id',t.event_date_id,'code',t.code,'label',t.label,'mode',t.mode,'value',t.value,'apply_to',t.apply_to
    )) from public.bordereau_taxes t where t.event_date_id = any(p_event_date_ids) and t.event_date_id in (select a.event_date_id from authorized a)),'[]'::jsonb)
  );
$$;
revoke all on function public.mobile_dashboard_finance_inputs(uuid,uuid[]) from public, anon;
grant execute on function public.mobile_dashboard_finance_inputs(uuid,uuid[]) to authenticated;
comment on function public.mobile_dashboard_finance_inputs(uuid,uuid[]) is
  'Atomic revenue inputs for the unchanged Web engine. Caller RLS and existing bordereau capability; no costs or plateau.';
