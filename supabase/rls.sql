alter table public.profiles enable row level security;
alter table public.divisions enable row level security;
alter table public.products enable row level security;
alter table public.templates enable row level security;
alter table public.designs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.proofs enable row level security;
alter table public.proof_approvals enable row level security;
alter table public.order_status_history enable row level security;
alter table public.files enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "update own customer profile" on public.profiles;
create policy "update own customer profile" on public.profiles
  for update using (id = auth.uid() and role = 'customer')
  with check (id = auth.uid() and role = 'customer');

drop policy if exists "public read divisions" on public.divisions;
create policy "public read divisions" on public.divisions
  for select using (true);

drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products
  for select using (active);

drop policy if exists "public read templates" on public.templates;
create policy "public read templates" on public.templates
  for select using (true);

drop policy if exists "read own designs" on public.designs;
create policy "read own designs" on public.designs
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "insert own designs" on public.designs;
create policy "insert own designs" on public.designs
  for insert with check (user_id = auth.uid());

drop policy if exists "update own designs" on public.designs;
create policy "update own designs" on public.designs
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "delete own designs" on public.designs;
create policy "delete own designs" on public.designs
  for delete using (user_id = auth.uid());

drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "read own order items" on public.order_items;
create policy "read own order items" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "read own proofs" on public.proofs;
create policy "read own proofs" on public.proofs
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "read own proof approvals" on public.proof_approvals;
create policy "read own proof approvals" on public.proof_approvals
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "read own status history" on public.order_status_history;
create policy "read own status history" on public.order_status_history
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manage divisions" on public.divisions;
create policy "admin manage divisions" on public.divisions
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manage products" on public.products;
create policy "admin manage products" on public.products
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manage templates" on public.templates;
create policy "admin manage templates" on public.templates
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manage orders" on public.orders;
create policy "admin manage orders" on public.orders
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manage order items" on public.order_items;
create policy "admin manage order items" on public.order_items
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manage proofs" on public.proofs;
create policy "admin manage proofs" on public.proofs
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manage proof approvals" on public.proof_approvals;
create policy "admin manage proof approvals" on public.proof_approvals
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin manage order status history" on public.order_status_history;
create policy "admin manage order status history" on public.order_status_history
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin only files" on public.files;
create policy "admin only files" on public.files
  for all using (public.is_admin()) with check (public.is_admin());
