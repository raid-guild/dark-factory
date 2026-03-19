alter table public.artifacts
  add column if not exists body_markdown text,
  add column if not exists body_text text;
