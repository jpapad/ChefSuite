-- Print customization fields on menus
alter table public.menus
  add column if not exists print_template text not null default 'classic'
    check (print_template in ('classic', 'modern', 'elegant')),
  add column if not exists logo_url      text,
  add column if not exists custom_footer text;
