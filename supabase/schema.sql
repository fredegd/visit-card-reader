-- Enable required extensions
create extension if not exists "pgcrypto";

-- Enums
create type card_status as enum ('uploaded', 'processing', 'ready', 'error');
create type card_side as enum ('front', 'back');
create type export_format as enum ('vcf', 'csv', 'json');

-- Tables
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status card_status not null default 'uploaded',
  front_image_id uuid,
  back_image_id uuid,
  extracted_json jsonb,
  normalized jsonb,
  full_name text,
  company text,
  title text,
  primary_email text,
  primary_phone text,
  primary_website text,
  raw_ocr jsonb,
  raw_qr jsonb,
  provider text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists card_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  side card_side not null,
  storage_path text not null,
  cropped_path text,
  cropped_width integer,
  cropped_height integer,
  crop_confidence double precision,
  mime text,
  width integer,
  height integer,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional migrations for existing installations
alter table cards add column if not exists raw_qr jsonb;
alter table card_images add column if not exists cropped_path text;
alter table card_images add column if not exists cropped_width integer;
alter table card_images add column if not exists cropped_height integer;
alter table card_images add column if not exists crop_confidence double precision;

alter table cards
  add constraint cards_front_image_fk foreign key (front_image_id) references card_images(id);

alter table cards
  add constraint cards_back_image_fk foreign key (back_image_id) references card_images(id);

create table if not exists card_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  format export_format not null,
  created_at timestamptz not null default now()
);

-- Update timestamps
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cards_updated_at
before update on cards
for each row execute function set_updated_at();

create trigger card_images_updated_at
before update on card_images
for each row execute function set_updated_at();

-- Indexes
create index if not exists cards_user_status_idx on cards (user_id, status);
create index if not exists cards_user_created_idx on cards (user_id, created_at desc);
create index if not exists card_images_user_card_idx on card_images (user_id, card_id);
create index if not exists card_exports_user_card_idx on card_exports (user_id, card_id);

-- RLS
alter table cards enable row level security;
alter table card_images enable row level security;
alter table card_exports enable row level security;

create policy "cards_select_own"
  on cards for select
  using (auth.uid() = user_id);

create policy "cards_insert_own"
  on cards for insert
  with check (auth.uid() = user_id);

create policy "cards_update_own"
  on cards for update
  using (auth.uid() = user_id);

create policy "cards_delete_own"
  on cards for delete
  using (auth.uid() = user_id);

create policy "card_images_select_own"
  on card_images for select
  using (auth.uid() = user_id);

create policy "card_images_insert_own"
  on card_images for insert
  with check (auth.uid() = user_id);

create policy "card_images_update_own"
  on card_images for update
  using (auth.uid() = user_id);

create policy "card_images_delete_own"
  on card_images for delete
  using (auth.uid() = user_id);

create policy "card_exports_select_own"
  on card_exports for select
  using (auth.uid() = user_id);

create policy "card_exports_insert_own"
  on card_exports for insert
  with check (auth.uid() = user_id);

create policy "card_exports_update_own"
  on card_exports for update
  using (auth.uid() = user_id);

create policy "card_exports_delete_own"
  on card_exports for delete
  using (auth.uid() = user_id);

-- Storage
-- Create a private bucket named "card-images" in the Supabase UI.
-- Then apply these policies on storage.objects:
-- Allow authenticated users to read/write their own objects (owner-based).
-- Example policies:

create policy "card_images_read_own"
  on storage.objects for select
  using (bucket_id = 'card-images' and auth.uid() = owner);

create policy "card_images_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'card-images' and auth.uid() = owner);

create policy "card_images_update_own"
  on storage.objects for update
  using (bucket_id = 'card-images' and auth.uid() = owner);

create policy "card_images_delete_own"
  on storage.objects for delete
  using (bucket_id = 'card-images' and auth.uid() = owner);
