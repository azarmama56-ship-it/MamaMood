create extension if not exists pgcrypto;

create table if not exists public.test_stats (
  id bigint primary key,
  test_takers bigint not null default 0
);

insert into public.test_stats(id,test_takers)
values (1,0)
on conflict (id) do nothing;

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid,
  age integer,
  status text,
  answers jsonb not null default '[]'::jsonb,
  score integer not null check (score between 0 and 30),
  self_harm_positive boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.test_results
  add column if not exists attempt_id uuid;

create unique index if not exists test_results_attempt_id_unique
on public.test_results(attempt_id)
where attempt_id is not null;

alter table public.test_stats enable row level security;
alter table public.test_results enable row level security;

drop policy if exists "allow_public_insert_results" on public.test_results;
drop policy if exists "public_read_counter" on public.test_stats;

create policy "public_read_counter"
on public.test_stats
for select
to anon, authenticated
using (id = 1);

grant usage on schema public to anon, authenticated;
grant select on public.test_stats to anon, authenticated;

revoke all on public.test_results from anon, authenticated;

drop function if exists public.complete_test(integer,text,jsonb,integer,boolean);
drop function if exists public.complete_test(uuid,integer,text,jsonb,integer,boolean);

create function public.complete_test(
  p_attempt_id uuid,
  p_age integer,
  p_status text,
  p_answers jsonb,
  p_score integer,
  p_self_harm_positive boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
  new_count bigint;
begin
  if p_attempt_id is null then
    raise exception 'attempt id required';
  end if;

  if p_age is null or p_age < 12 or p_age > 100 then
    raise exception 'invalid age';
  end if;

  if p_status not in ('pregnant','mom','neither') then
    raise exception 'invalid status';
  end if;

  if p_score is null or p_score < 0 or p_score > 30 then
    raise exception 'invalid score';
  end if;

  insert into public.test_results(
    attempt_id, age, status, answers, score, self_harm_positive
  )
  values(
    p_attempt_id, p_age, p_status, coalesce(p_answers,'[]'::jsonb),
    p_score, coalesce(p_self_harm_positive,false)
  )
  on conflict (attempt_id) where attempt_id is not null
  do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    update public.test_stats
    set test_takers = test_takers + 1
    where id = 1
    returning test_takers into new_count;
  else
    select test_takers into new_count
    from public.test_stats
    where id = 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'saved', inserted_id is not null,
    'test_takers', coalesce(new_count,0)
  );
end;
$$;

revoke all on function public.complete_test(uuid,integer,text,jsonb,integer,boolean) from public;
grant execute on function public.complete_test(uuid,integer,text,jsonb,integer,boolean)
to anon, authenticated;

notify pgrst, 'reload schema';
