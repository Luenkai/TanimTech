-- TanimTech private profile, field history, crop tracking, and feedback.
-- Run in the Supabase SQL Editor. Passwords are handled only by Supabase Auth.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  workspace_name text not null default 'Field planner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[A-Za-z0-9_]{3,20}$'
  )
);

create unique index if not exists profiles_username_ci_unique
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.field_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  conditions jsonb not null default '{}'::jsonb check (jsonb_typeof(conditions) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  input_mode text not null check (input_mode in ('manual', 'image')),
  input_data jsonb not null default '{}'::jsonb check (jsonb_typeof(input_data) = 'object'),
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  model_name text,
  model_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.crop_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recommendation_run_id uuid references public.recommendation_runs (id) on delete set null,
  crop_slug text not null check (char_length(trim(crop_slug)) between 1 and 120),
  crop_name text not null check (char_length(trim(crop_name)) between 1 and 160),
  status text not null default 'in_progress'
    check (status in ('planned', 'in_progress', 'completed', 'skipped')),
  source_mode text not null check (source_mode in ('manual', 'image')),
  fit_score integer check (fit_score is null or fit_score between 0 and 100),
  notes text not null default '' check (char_length(notes) <= 1000),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, crop_slug)
);

create table if not exists public.model_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recommendation_run_id uuid not null references public.recommendation_runs (id) on delete cascade,
  feedback_kind text not null check (feedback_kind in ('recommendation', 'soil_image')),
  helpful boolean,
  corrected_crop_slug text,
  corrected_soil_type text check (
    corrected_soil_type is null or corrected_soil_type in ('Clay', 'Loam', 'Sandy', 'Silty', 'Peaty', 'Unknown')
  ),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recommendation_run_id, user_id, feedback_kind),
  constraint model_feedback_has_content check (
    helpful is not null
    or corrected_crop_slug is not null
    or corrected_soil_type is not null
    or char_length(trim(comment)) > 0
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_tanimtech_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    case
      when (new.raw_user_meta_data ->> 'username') ~ '^[A-Za-z0-9_]{3,20}$'
      then new.raw_user_meta_data ->> 'username'
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_tanimtech_auth_user_created on auth.users;
create trigger on_tanimtech_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_tanimtech_user();

with ranked_users as (
  select id,
    raw_user_meta_data ->> 'username' as username,
    row_number() over (
      partition by lower(raw_user_meta_data ->> 'username')
      order by id
    ) as username_rank
  from auth.users
)
insert into public.profiles (id, username)
select id,
  case
    when username ~ '^[A-Za-z0-9_]{3,20}$' and username_rank = 1
    then username
    else null
  end
from ranked_users
on conflict (id) do nothing;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists field_profiles_set_updated_at on public.field_profiles;
create trigger field_profiles_set_updated_at before update on public.field_profiles
  for each row execute function public.set_updated_at();
drop trigger if exists crop_plans_set_updated_at on public.crop_plans;
create trigger crop_plans_set_updated_at before update on public.crop_plans
  for each row execute function public.set_updated_at();
drop trigger if exists model_feedback_set_updated_at on public.model_feedback;
create trigger model_feedback_set_updated_at before update on public.model_feedback
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.field_profiles enable row level security;
alter table public.recommendation_runs enable row level security;
alter table public.crop_plans enable row level security;
alter table public.model_feedback enable row level security;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage their own field profiles" on public.field_profiles;
create policy "Users manage their own field profiles" on public.field_profiles
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own recommendation runs" on public.recommendation_runs;
create policy "Users manage their own recommendation runs" on public.recommendation_runs
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own crop plans" on public.crop_plans;
create policy "Users manage their own crop plans" on public.crop_plans
  for all to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      recommendation_run_id is null
      or exists (
        select 1 from public.recommendation_runs r
        where r.id = recommendation_run_id and r.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users manage their own model feedback" on public.model_feedback;
create policy "Users manage their own model feedback" on public.model_feedback
  for all to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.recommendation_runs r
      where r.id = recommendation_run_id and r.user_id = (select auth.uid())
    )
  );

grant select on public.profiles to authenticated;
grant update (username, workspace_name) on public.profiles to authenticated;
grant select, insert, update, delete on
  public.field_profiles, public.recommendation_runs, public.crop_plans, public.model_feedback
  to authenticated;

comment on table public.recommendation_runs is
  'Stores manual and photo-based recommendation outputs only; original soil photos are not stored.';
comment on table public.model_feedback is
  'User feedback for later review/training; feedback does not automatically change the live model.';

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_tanimtech_user() from public, anon, authenticated;
