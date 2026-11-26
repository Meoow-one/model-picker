-- 模型选型工作台 · 账户数据表
-- 在 Supabase Dashboard → SQL Editor 里整体运行一次。
-- 设计原则：所有表启用 RLS，只允许 auth.uid() 读写自己的行；前端只用 anon key。

create extension if not exists pgcrypto;

-- 收藏型号 ------------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

-- 保存的对比清单（2–4 个型号）---------------------------------------
create table if not exists public.saved_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  model_ids text[] not null check (array_length(model_ids, 1) between 2 and 4),
  created_at timestamptz not null default now()
);

-- 对话线程 ------------------------------------------------------------
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 对话消息 ------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);
create index if not exists saved_comparisons_user_created_idx
  on public.saved_comparisons (user_id, created_at desc);
create index if not exists chat_threads_user_updated_idx
  on public.chat_threads (user_id, updated_at desc);
create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at asc);
create index if not exists chat_messages_user_idx
  on public.chat_messages (user_id);

-- RLS ----------------------------------------------------------------
alter table public.favorites enable row level security;
alter table public.saved_comparisons enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists favorites_select_own on public.favorites;
drop policy if exists favorites_insert_own on public.favorites;
drop policy if exists favorites_delete_own on public.favorites;

create policy favorites_select_own on public.favorites
  for select using (auth.uid() = user_id);
create policy favorites_insert_own on public.favorites
  for insert with check (auth.uid() = user_id);
create policy favorites_delete_own on public.favorites
  for delete using (auth.uid() = user_id);

drop policy if exists comparisons_select_own on public.saved_comparisons;
drop policy if exists comparisons_insert_own on public.saved_comparisons;
drop policy if exists comparisons_delete_own on public.saved_comparisons;

create policy comparisons_select_own on public.saved_comparisons
  for select using (auth.uid() = user_id);
create policy comparisons_insert_own on public.saved_comparisons
  for insert with check (auth.uid() = user_id);
create policy comparisons_delete_own on public.saved_comparisons
  for delete using (auth.uid() = user_id);

drop policy if exists threads_select_own on public.chat_threads;
drop policy if exists threads_insert_own on public.chat_threads;
drop policy if exists threads_update_own on public.chat_threads;
drop policy if exists threads_delete_own on public.chat_threads;

create policy threads_select_own on public.chat_threads
  for select using (auth.uid() = user_id);
create policy threads_insert_own on public.chat_threads
  for insert with check (auth.uid() = user_id);
create policy threads_update_own on public.chat_threads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy threads_delete_own on public.chat_threads
  for delete using (auth.uid() = user_id);

drop policy if exists messages_select_own on public.chat_messages;
drop policy if exists messages_insert_own on public.chat_messages;
drop policy if exists messages_delete_own on public.chat_messages;

create policy messages_select_own on public.chat_messages
  for select using (auth.uid() = user_id);
-- 不能把消息插进别人的线程：线程必须也属于当前用户
create policy messages_insert_own on public.chat_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  );
create policy messages_delete_own on public.chat_messages
  for delete using (auth.uid() = user_id);

-- 显式收窄权限：匿名用户不能读写这些表，登录用户仍受 RLS 限制
revoke all on public.favorites from anon;
revoke all on public.saved_comparisons from anon;
revoke all on public.chat_threads from anon;
revoke all on public.chat_messages from anon;

grant select, insert, delete on public.favorites to authenticated;
grant select, insert, delete on public.saved_comparisons to authenticated;
grant select, insert, update, delete on public.chat_threads to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;