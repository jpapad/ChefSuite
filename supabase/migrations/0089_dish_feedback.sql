-- ============================================================
-- Chefsuite — Guest feedback from the QR menu
-- Guests rate the dishes they had (1–5 stars + optional comment). Anonymous
-- visitors can only write through submit_dish_feedback, which checks that
-- the item is on an active menu. The team reads it in the app.
-- ============================================================

create table if not exists public.dish_feedback (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  menu_id       uuid references public.menus(id) on delete set null,
  menu_item_id  uuid references public.menu_items(id) on delete set null,
  recipe_id     uuid references public.recipes(id) on delete set null,
  item_name     text not null,
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (comment is null or char_length(comment) <= 500),
  lang          text,
  created_at    timestamptz not null default now()
);

alter table public.dish_feedback enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='dish_feedback' and policyname='team members read feedback') then
    create policy "team members read feedback" on public.dish_feedback for select
      using (team_id = public.current_team_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='dish_feedback' and policyname='team members delete feedback') then
    create policy "team members delete feedback" on public.dish_feedback for delete
      using (team_id = public.current_team_id());
  end if;
end $$;

create index if not exists dish_feedback_team_idx on public.dish_feedback(team_id, created_at desc);
create index if not exists dish_feedback_item_idx on public.dish_feedback(menu_item_id);
create index if not exists dish_feedback_recipe_idx on public.dish_feedback(recipe_id);

create or replace function public.submit_dish_feedback(
  p_menu_id  uuid,
  p_item_id  uuid,
  p_rating   integer,
  p_comment  text default null,
  p_lang     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be 1–5' using errcode = '22023';
  end if;

  select mi.id, mi.name, mi.recipe_id, m.team_id
    into v_item
    from public.menu_items mi
    join public.menu_sections ms on ms.id = mi.section_id
    join public.menus m on m.id = ms.menu_id
   where mi.id = p_item_id and m.id = p_menu_id and m.active = true;

  if v_item is null then
    raise exception 'Dish not found' using errcode = '22023';
  end if;

  -- Light flood guard: max 30 ratings per dish per 10 minutes
  if (select count(*) from public.dish_feedback
       where menu_item_id = p_item_id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Too many ratings, try again later' using errcode = '54000';
  end if;

  insert into public.dish_feedback (team_id, menu_id, menu_item_id, recipe_id, item_name, rating, comment, lang)
  values (v_item.team_id, p_menu_id, p_item_id, v_item.recipe_id, v_item.name, p_rating,
          nullif(left(trim(coalesce(p_comment, '')), 500), ''), left(p_lang, 5));
end;
$$;

revoke all on function public.submit_dish_feedback(uuid, uuid, integer, text, text) from public;
grant execute on function public.submit_dish_feedback(uuid, uuid, integer, text, text) to anon, authenticated;
