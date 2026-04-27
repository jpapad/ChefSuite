-- Link prep tasks to the menu they were generated from (optional)
alter table public.prep_tasks
  add column if not exists menu_id uuid references public.menus(id) on delete set null;

create index if not exists prep_tasks_menu_idx on public.prep_tasks(menu_id);
