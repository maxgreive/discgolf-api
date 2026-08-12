create table training_participants (
  id uuid primary key default gen_random_uuid(),
  training_date date not null,
  display_name varchar(40) not null check (char_length(trim(display_name)) between 1 and 40),
  removal_token_hash char(64) not null,
  created_at timestamptz not null default now(),
  unique (training_date, display_name)
);

create index training_participants_date_idx on training_participants(training_date, created_at);
