-- DULCECESTA - base de datos online
-- Ejecuta este archivo completo en Supabase > SQL Editor.
-- Después crea el usuario administrador desde Authentication > Users
-- y ejecuta la última instrucción reemplazando el UUID.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  emoji text default '🍬',
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  delivery_address text,
  customer_note text,
  status text not null default 'Pendiente'
    check (status in ('Pendiente','Preparando','Entregado','Cancelado')),
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products
for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read orders" on public.orders;
create policy "Admins read orders" on public.orders
for select to authenticated using (public.is_admin());

drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read order items" on public.order_items;
create policy "Admins read order items" on public.order_items
for select to authenticated using (public.is_admin());

-- RPC: el cliente envía un pedido sin tener acceso directo a todo el inventario.
-- Comprueba stock, calcula precios desde la base de datos y descuenta existencias
-- dentro de una transacción.
create or replace function public.create_order(p_order jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product products%rowtype;
  v_qty integer;
  v_total numeric(12,2) := 0;
begin
  insert into public.orders(customer_name,customer_phone,delivery_address,customer_note)
  values (
    trim(p_order->>'customer_name'),
    trim(p_order->>'customer_phone'),
    nullif(trim(p_order->>'delivery_address'),''),
    nullif(trim(p_order->>'customer_note'),'')
  )
  returning id into v_order_id;

  if length(trim(p_order->>'customer_name')) = 0 or length(trim(p_order->>'customer_phone')) = 0 then
    raise exception 'Nombre y teléfono son obligatorios';
  end if;

  for v_item in select * from jsonb_array_elements(p_order->'items')
  loop
    v_qty := (v_item->>'quantity')::integer;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and active = true
    for update;

    if not found then raise exception 'Producto no disponible'; end if;
    if v_qty <= 0 then raise exception 'Cantidad inválida'; end if;
    if v_product.stock < v_qty then
      raise exception 'Stock insuficiente para: %', v_product.name;
    end if;

    insert into public.order_items(order_id,product_id,quantity,unit_price)
    values(v_order_id,v_product.id,v_qty,v_product.price);

    update public.products set stock = stock - v_qty where id = v_product.id;
    v_total := v_total + (v_product.price * v_qty);
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return v_order_id;
exception when others then
  raise;
end;
$$;

grant execute on function public.create_order(jsonb) to anon, authenticated;

-- Storage para fotos de productos
insert into storage.buckets (id, name, public)
values ('product-images','product-images',true)
on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images" on storage.objects
for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images" on storage.objects
for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images" on storage.objects
for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images" on storage.objects
for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- Después de crear el usuario administrador en Authentication > Users:
-- 1) copia su UUID
-- 2) ejecuta:
-- insert into public.profiles(id,role) values ('UUID-DEL-ADMIN','admin')
-- on conflict (id) do update set role='admin';

-- Productos iniciales de ejemplo:
insert into public.products(name,price,stock,emoji) values
('Caramelos surtidos',5,25,'🍬'),
('Galletas de chocolate',3.50,12,'🍪'),
('Gomitas frutales',4,20,'🍭'),
('Bombones',6,18,'🍫'),
('Nubes de azúcar',3,15,'☁️'),
('Paletas de colores',2.50,14,'🍭'),
('Caja dulce sorpresa',12,8,'🎁'),
('Mini cesta regalo',15,15,'🧺')
on conflict do nothing;
