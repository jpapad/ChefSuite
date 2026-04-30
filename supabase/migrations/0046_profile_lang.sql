-- Add preferred language to profiles
alter table profiles
  add column if not exists preferred_lang text not null default 'en'
  check (preferred_lang in ('en', 'el', 'bg'));
