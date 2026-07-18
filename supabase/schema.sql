
-- ZERO HOUR RP VIDEO HUB - RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'viewer' check (role in ('viewer','uploader','admin','owner')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,display_name)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)))
 on conflict(id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.categories(
 id uuid primary key default gen_random_uuid(),
 name text unique not null,
 created_at timestamptz not null default now()
);

insert into public.categories(name) values
('Server Updates'),('Announcements'),('Trailers'),('Tutorials'),('Community'),('Events'),
('Police'),('EMS'),('Fire Department'),('Civilian'),('Criminal'),('Businesses'),
('Economy'),('Survival'),('Custom Scripts'),('Custom Vehicles'),('Clothing'),
('Housing'),('Development'),('Staff News'),('Livestreams'),('Shorts'),
('Funny Moments'),('Cinematics'),('Showcases'),('Other')
on conflict(name) do nothing;

create table if not exists public.videos(
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text default '',
 category_id uuid references public.categories(id) on delete set null,
 video_url text not null,
 video_path text,
 thumbnail_url text,
 thumbnail_path text,
 uploader_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'draft' check(status in ('public','draft')),
 views bigint not null default 0,
 created_at timestamptz not null default now(),
 published_at timestamptz
);
create table if not exists public.comments(
 id uuid primary key default gen_random_uuid(),
 video_id uuid not null references public.videos(id) on delete cascade,
 author_name text not null,
 body text not null,
 approved boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.reactions(
 id uuid primary key default gen_random_uuid(),
 video_id uuid not null references public.videos(id) on delete cascade,
 visitor_key text not null,
 reaction text not null check(reaction in ('like','dislike')),
 created_at timestamptz not null default now(),
 unique(video_id,visitor_key)
);

create or replace function public.is_approved_staff()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and approved=true and role in ('owner','admin','uploader'));
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and approved=true and role in ('owner','admin'));
$$;
create or replace function public.increment_video_views(video_id_input uuid)
returns void language plpgsql security definer set search_path=public as $$
begin update videos set views=views+1 where id=video_id_input and status='public'; end; $$;
grant execute on function public.increment_video_views(uuid) to anon,authenticated;

alter table profiles enable row level security;alter table categories enable row level security;alter table videos enable row level security;alter table comments enable row level security;alter table reactions enable row level security;

drop policy if exists "profiles self read" on profiles;
create policy "profiles self read" on profiles for select using(id=auth.uid() or public.is_admin());
drop policy if exists "admins update profiles" on profiles;
create policy "admins update profiles" on profiles for update using(public.is_admin()) with check(public.is_admin());

drop policy if exists "categories public read" on categories;
create policy "categories public read" on categories for select using(true);
drop policy if exists "staff create category" on categories;
create policy "staff create category" on categories for insert to authenticated with check(public.is_approved_staff());

drop policy if exists "public read videos" on videos;
create policy "public read videos" on videos for select using(status='public' or public.is_approved_staff());
drop policy if exists "staff insert videos" on videos;
create policy "staff insert videos" on videos for insert to authenticated with check(public.is_approved_staff() and uploader_id=auth.uid());
drop policy if exists "staff update videos" on videos;
create policy "staff update videos" on videos for update to authenticated using(public.is_approved_staff()) with check(public.is_approved_staff());
drop policy if exists "staff delete videos" on videos;
create policy "staff delete videos" on videos for delete to authenticated using(public.is_approved_staff());

drop policy if exists "public read approved comments" on comments;
create policy "public read approved comments" on comments for select using(approved=true or public.is_approved_staff());
drop policy if exists "public add comments" on comments;
create policy "public add comments" on comments for insert to anon,authenticated with check(approved=true);
drop policy if exists "staff delete comments" on comments;
create policy "staff delete comments" on comments for delete to authenticated using(public.is_approved_staff());

drop policy if exists "public read reactions" on reactions;
create policy "public read reactions" on reactions for select using(true);
drop policy if exists "public add reactions" on reactions;
create policy "public add reactions" on reactions for insert to anon,authenticated with check(true);
drop policy if exists "public update reactions" on reactions;
create policy "public update reactions" on reactions for update to anon,authenticated using(true) with check(true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('videos','videos',true,524288000,array['video/mp4','video/webm'])
on conflict(id) do update set public=true;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('thumbnails','thumbnails',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true;

drop policy if exists "public view videos storage" on storage.objects;
create policy "public view videos storage" on storage.objects for select using(bucket_id in ('videos','thumbnails'));
drop policy if exists "staff upload videos storage" on storage.objects;
create policy "staff upload videos storage" on storage.objects for insert to authenticated with check(bucket_id in ('videos','thumbnails') and public.is_approved_staff());
drop policy if exists "staff delete videos storage" on storage.objects;
create policy "staff delete videos storage" on storage.objects for delete to authenticated using(bucket_id in ('videos','thumbnails') and public.is_approved_staff());

-- AFTER CREATING YOUR FIRST AUTH USER, MAKE IT OWNER:
-- update public.profiles set role='owner', approved=true where email='YOUR_EMAIL_HERE';
