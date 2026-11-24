create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions on delete restrict,
  slug text unique not null,
  name text not null,
  description text,
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  name text not null,
  base_width_mm numeric(6, 2) not null default 100 check (base_width_mm > 0),
  base_height_mm numeric(6, 2) not null default 100 check (base_height_mm > 0),
  print_area jsonb not null check (jsonb_typeof(print_area) = 'object'),
  bleed_mm numeric(6, 2) not null default 3 check (bleed_mm >= 0),
  dpi integer not null default 300 check (dpi between 72 and 1200),
  placeholders jsonb not null default '[]'::jsonb check (jsonb_typeof(placeholders) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  product_id uuid not null references public.products on delete restrict,
  template_id uuid not null references public.templates on delete restrict,
  name text not null default 'Untitled design',
  design_json jsonb not null check (jsonb_typeof(design_json) = 'object'),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete restrict,
  status text not null default 'quote'
    check (status in ('quote', 'order', 'artwork', 'proof', 'production', 'completed')),
  currency text not null default 'gbp',
  subtotal integer not null default 0 check (subtotal >= 0),
  vat integer not null default 0 check (vat >= 0),
  total integer not null default 0 check (total >= 0),
  stripe_session_id text unique,
  paid_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid not null references public.products on delete restrict,
  design_id uuid references public.designs on delete set null,
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  version integer not null check (version > 0),
  image_path text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested')),
  note text,
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

create table if not exists public.proof_approvals (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.proofs on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  version integer not null check (version > 0),
  user_id uuid not null references public.profiles on delete restrict,
  action text not null check (action in ('approved', 'changes_requested')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  kind text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists products_division_id_idx on public.products (division_id);
create index if not exists templates_product_id_idx on public.templates (product_id);
create index if not exists designs_user_id_idx on public.designs (user_id);
create index if not exists orders_user_id_created_at_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists proofs_order_id_version_idx on public.proofs (order_id, version desc);
create index if not exists proof_approvals_order_id_idx on public.proof_approvals (order_id);
create index if not exists order_status_history_order_id_idx on public.order_status_history (order_id, created_at desc);
create index if not exists files_order_id_idx on public.files (order_id);
