-- Workouts table
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  date timestamptz not null default now(),
  total_yards int not null default 0,
  pool_length int not null default 25,
  pool_unit text not null default 'yards' check (pool_unit in ('yards', 'meters')),
  feeling_score int check (feeling_score between 1 and 10),
  notes text,
  duration_minutes int,
  created_at timestamptz not null default now()
);

-- Sets table
create table sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references workouts(id) on delete cascade not null,
  order_index int not null,
  reps int not null default 1,
  distance int not null,
  stroke text not null default 'free' check (stroke in ('free', 'back', 'breast', 'fly', 'IM', 'kick', 'drill', 'mixed')),
  interval_seconds int,
  description text
);

-- Wearable data table
create table wearable_data (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references workouts(id) on delete set null,
  user_id uuid references auth.users(id) not null,
  source text not null check (source in ('apple_health', 'whoop', 'fitbit')),
  date timestamptz not null,
  avg_heart_rate int,
  max_heart_rate int,
  calories int,
  strain_score float,
  recovery_score float,
  hrv float,
  sleep_score float,
  raw_data jsonb
);

-- Wearable connections table
create table wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  provider text not null check (provider in ('whoop', 'fitbit')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  unique(user_id, provider)
);

-- Row Level Security
alter table workouts enable row level security;
alter table sets enable row level security;
alter table wearable_data enable row level security;
alter table wearable_connections enable row level security;

create policy "Users can CRUD own workouts" on workouts
  for all using (auth.uid() = user_id);

create policy "Users can CRUD own sets" on sets
  for all using (workout_id in (select id from workouts where user_id = auth.uid()));

create policy "Users can CRUD own wearable data" on wearable_data
  for all using (auth.uid() = user_id);

create policy "Users can CRUD own wearable connections" on wearable_connections
  for all using (auth.uid() = user_id);

-- Indexes
create index workouts_user_date on workouts(user_id, date desc);
create index sets_workout on sets(workout_id, order_index);
create index wearable_data_user_date on wearable_data(user_id, date desc);
