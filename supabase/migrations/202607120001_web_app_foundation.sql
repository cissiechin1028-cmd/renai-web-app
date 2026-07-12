-- RenAI Web App foundation
-- Run through Supabase migrations. All user-owned tables are protected by RLS.

create extension if not exists pgcrypto;

create type public.app_plan as enum ('free', 'pro');
create type public.analysis_mode as enum ('reply', 'analysis');
create type public.analysis_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  plan public.app_plan not null default 'free',
  lifetime_free_usage integer not null default 0 check (lifetime_free_usage between 0 and 5),
  pro_period_usage integer not null default 0 check (pro_period_usage between 0 and 100),
  pro_period_start timestamptz,
  pro_period_end timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,
  role text not null default 'user' check (role in ('user', 'admin')),
  privacy_accepted_at timestamptz,
  age_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode public.analysis_mode not null,
  status public.analysis_status not null default 'queued',
  title text not null default '新しい分析',
  source_image_count integer not null default 1 check (source_image_count between 1 and 10),
  input_metadata jsonb not null default '{}'::jsonb,
  result jsonb,
  error_code text,
  processing_ms integer check (processing_ms is null or processing_ms >= 0),
  model_name text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  event_type text not null check (event_type in ('analysis_started', 'analysis_completed', 'analysis_failed', 'credit_refund')),
  credit_delta integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.subscription_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_id text,
  event_name text not null,
  source text,
  campaign text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analyses_user_created_idx on public.analyses(user_id, created_at desc);
create index analyses_status_created_idx on public.analyses(status, created_at desc);
create index usage_events_user_created_idx on public.usage_events(user_id, created_at desc);
create index product_events_name_created_idx on public.product_events(event_name, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger auth_user_created after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.usage_events enable row level security;
alter table public.subscription_events enable row level security;
alter table public.product_events enable row level security;

create policy "profiles_read_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own_safe_fields" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Prevent browser clients from changing plan, usage, Stripe ids, or role even
-- when they own the row. Those fields are server-controlled.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, privacy_accepted_at, age_confirmed_at) on public.profiles to authenticated;

create policy "analyses_read_own" on public.analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "analyses_delete_own" on public.analyses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "usage_read_own" on public.usage_events for select to authenticated using ((select auth.uid()) = user_id);

-- Product events may be created through the authenticated API only.
create policy "product_events_read_own" on public.product_events for select to authenticated using ((select auth.uid()) = user_id);

-- No client insert policies are intentionally granted for analyses, usage,
-- subscriptions, or product events. The API writes them with the service role
-- after validating the user's access token and plan limit.

create or replace function public.reserve_analysis_credit(target_user_id uuid)
returns table (allowed boolean, plan public.app_plan, used integer, credit_limit integer)
language plpgsql security definer set search_path = '' as $$
declare
  current_profile public.profiles%rowtype;
begin
  select * into current_profile from public.profiles
  where id = target_user_id for update;

  if not found then
    return query select false, 'free'::public.app_plan, 0, 5;
    return;
  end if;

  if current_profile.plan = 'pro' then
    if current_profile.pro_period_end is null or current_profile.pro_period_end <= now()
       or current_profile.pro_period_usage >= 100 then
      return query select false, 'pro'::public.app_plan, current_profile.pro_period_usage, 100;
      return;
    end if;

    update public.profiles set pro_period_usage = pro_period_usage + 1 where id = target_user_id;
    return query select true, 'pro'::public.app_plan, current_profile.pro_period_usage + 1, 100;
    return;
  end if;

  if current_profile.lifetime_free_usage >= 5 then
    return query select false, 'free'::public.app_plan, current_profile.lifetime_free_usage, 5;
    return;
  end if;

  update public.profiles set lifetime_free_usage = lifetime_free_usage + 1 where id = target_user_id;
  return query select true, 'free'::public.app_plan, current_profile.lifetime_free_usage + 1, 5;
end;
$$;

revoke all on function public.reserve_analysis_credit(uuid) from public, anon, authenticated;
grant execute on function public.reserve_analysis_credit(uuid) to service_role;

create or replace function public.refund_analysis_credit(
  target_user_id uuid,
  charged_plan public.app_plan
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if charged_plan = 'pro' then
    update public.profiles
    set pro_period_usage = greatest(0, pro_period_usage - 1)
    where id = target_user_id;
  else
    update public.profiles
    set lifetime_free_usage = greatest(0, lifetime_free_usage - 1)
    where id = target_user_id;
  end if;
end;
$$;

revoke all on function public.refund_analysis_credit(uuid, public.app_plan) from public, anon, authenticated;
grant execute on function public.refund_analysis_credit(uuid, public.app_plan) to service_role;
