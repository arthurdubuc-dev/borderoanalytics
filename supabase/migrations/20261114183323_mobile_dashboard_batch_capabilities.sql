-- Read-only batch of the existing date capability resolver. No new financial grant.
create or replace function public.mobile_dashboard_date_capabilities(
  p_workspace_id uuid,
  p_event_date_ids uuid[]
)
returns table(event_date_id uuid, capabilities jsonb)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce(public.get_my_account_lifecycle()->>'account_status','') <> 'active' then
    raise exception 'Account unavailable' using errcode = '42501';
  end if;
  if p_workspace_id is null or p_event_date_ids is null
     or cardinality(p_event_date_ids) > 500 then
    raise exception 'Invalid capability scope' using errcode = '22023';
  end if;
  return query
    with requested as materialized (
      select distinct id from unnest(p_event_date_ids) as ids(id)
    )
    select ed.id, public.get_date_capabilities(ed.id)
    from public.event_dates ed
    join requested r on r.id = ed.id
    where ed.workspace_id = p_workspace_id
    order by ed.id;
end;
$$;
revoke all on function public.mobile_dashboard_date_capabilities(uuid,uuid[]) from public, anon;
grant execute on function public.mobile_dashboard_date_capabilities(uuid,uuid[]) to authenticated;
comment on function public.mobile_dashboard_date_capabilities(uuid,uuid[]) is
  'Bordero mobile: existing date capabilities in a bounded batch, under caller RLS.';

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
    where c.event_date_id in (select a.event_date_id from authorized a)
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
    )) from public.event_dates d where d.id in (select a.event_date_id from authorized a)),'[]'::jsonb),
    'projects',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'workspace_id',p.workspace_id,'owner_org_id',p.owner_org_id,'vat_rate',p.vat_rate,'tax_profile',p.tax_profile
    )) from public.projects p where p.workspace_id=p_workspace_id and p.archived_at is null
       and p.id in (select d.project_id from public.event_dates d join authorized a on a.event_date_id=d.id)),'[]'::jsonb),
    'sales',coalesce((select jsonb_agg(jsonb_build_object(
       'id',s.id,'event_date_id',s.event_date_id,'ticket_price_id',s.ticket_price_id,'quantity',s.quantity,'platform',s.platform
    )) from public.sales s where s.event_date_id in (select a.event_date_id from authorized a)),'[]'::jsonb),
    'prices',coalesce((select jsonb_agg(jsonb_build_object(
       'id',p.id,'event_date_id',p.event_date_id,'tariff_name',p.tariff_name,'price_ht',p.price_ht,
       'dl_producer',p.dl_producer,'dl_venue',p.dl_venue,'dl_distribution',p.dl_distribution
    )) from public.ticket_prices p where p.event_date_id in (select a.event_date_id from authorized a)),'[]'::jsonb),
    'taxes',coalesce((select jsonb_agg(jsonb_build_object(
       'event_date_id',t.event_date_id,'code',t.code,'label',t.label,'mode',t.mode,'value',t.value,'apply_to',t.apply_to
    )) from public.bordereau_taxes t where t.event_date_id in (select a.event_date_id from authorized a)),'[]'::jsonb)
  );
$$;
revoke all on function public.mobile_dashboard_finance_inputs(uuid,uuid[]) from public, anon;
grant execute on function public.mobile_dashboard_finance_inputs(uuid,uuid[]) to authenticated;
comment on function public.mobile_dashboard_finance_inputs(uuid,uuid[]) is
  'Atomic revenue inputs for the unchanged Web engine. Caller RLS and existing bordereau capability; no costs or plateau.';
