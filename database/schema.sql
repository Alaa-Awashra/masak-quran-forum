-- =====================================================================
-- ملتقى المسك القرآني — مخطط قاعدة البيانات (PostgreSQL / Supabase)
-- شغّله مرة واحدة من: Supabase → SQL Editor  (أو: npm run migrate)
-- آمن لإعادة التشغيل أكثر من مرة (idempotent)
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;   -- لمنع تعارض المواعيد على مستوى قاعدة البيانات

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- المستخدمون (المسؤول الإداري + المشرفون)
--   password_hash : للتحقق عند الدخول (bcrypt)
--   password_enc  : نسخة مشفرة (AES-256-GCM) ليتمكن المسؤول من عرضها
-- ---------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  password_hash text not null,
  password_enc  text,
  role          text not null check (role in ('admin', 'supervisor')),
  full_name     text not null,
  phone         text,
  email         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists users_username_key on users (lower(username));
-- حساب مسؤول واحد فقط
create unique index if not exists users_single_admin on users (role) where role = 'admin';

drop trigger if exists trg_users_updated on users;
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- المشرفون  (male = مشرف ذكور، female = مشرفة إناث، kids = مشرف كيدز)
-- ---------------------------------------------------------------------
create table if not exists supervisors (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references users(id) on delete cascade,
  supervisor_type   text not null check (supervisor_type in ('male', 'female', 'kids')),
  status            text not null default 'active' check (status in ('active', 'suspended')),
  birth_date        date,
  address           text,
  national_id       text,
  qualification     text,
  join_date         date not null default current_date,
  notes             text,
  extra             jsonb not null default '{}'::jsonb,   -- حقول إضافية مستقبلية
  suspended_at      timestamptz,
  suspension_reason text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists supervisors_status_idx on supervisors (status);

drop trigger if exists trg_supervisors_updated on supervisors;
create trigger trg_supervisors_updated before update on supervisors
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- الطلاب
--   supervisor_id يصبح NULL إذا حُذف المشرف (طالب "بدون مشرف" حتى يُنقل)
--   initial_parts : ما كان يحفظه الطالب عند الانضمام (بالأجزاء، مثال 0.55)
-- ---------------------------------------------------------------------
create table if not exists students (
  id                uuid primary key default gen_random_uuid(),
  supervisor_id     uuid references supervisors(id) on delete set null,
  full_name         text not null,
  gender            text not null check (gender in ('male', 'female')),
  birth_date        date,
  phone             text,
  guardian_name     text,
  guardian_phone    text,
  address           text,
  join_date         date not null default current_date,
  initial_parts     numeric(5, 2) not null default 0 check (initial_parts >= 0 and initial_parts <= 30),
  status            text not null default 'active' check (status in ('active', 'suspended')),
  suspended_at      timestamptz,
  suspension_reason text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists students_supervisor_idx on students (supervisor_id);
create index if not exists students_status_idx on students (status);

drop trigger if exists trg_students_updated on students;
create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- التحذيرات اليدوية على الطلاب
-- ---------------------------------------------------------------------
create table if not exists student_warnings (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  reason      text not null,
  active      boolean not null default true,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists student_warnings_student_idx on student_warnings (student_id) where active;

-- ---------------------------------------------------------------------
-- المواعيد: تسميع + امتحان سورة
--   status: scheduled (محجوز) | completed (تم) | missed (لم يلتزم) | cancelled (ملغي)
--   القيدان في الأسفل يمنعان تداخل مواعيد نفس المشرف أو نفس الطالب
-- ---------------------------------------------------------------------
create table if not exists appointments (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students(id) on delete cascade,
  supervisor_id    uuid references supervisors(id) on delete set null,
  kind             text not null check (kind in ('recitation', 'exam')),
  recitation_type  text check (recitation_type in ('new', 'review')),
  surah            text,
  portion          text,
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  status           text not null default 'scheduled'
                   check (status in ('scheduled', 'completed', 'missed', 'cancelled')),
  pages            numeric(5, 1) check (pages is null or (pages >= 0 and pages <= 604)),
  grade            numeric(5, 2) check (grade is null or (grade >= 0 and grade <= 100)),
  notes            text,
  completed_at     timestamptz,
  reschedule_count integer not null default 0,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint appt_time_order check (end_at > start_at),
  constraint appt_no_overlap_supervisor
    exclude using gist (supervisor_id with =, tstzrange(start_at, end_at, '[)') with &&)
    where (status = 'scheduled'),
  constraint appt_no_overlap_student
    exclude using gist (student_id with =, tstzrange(start_at, end_at, '[)') with &&)
    where (status = 'scheduled')
);
create index if not exists appointments_student_idx    on appointments (student_id, start_at desc);
create index if not exists appointments_supervisor_idx on appointments (supervisor_id, start_at);
create index if not exists appointments_start_idx      on appointments (start_at);

drop trigger if exists trg_appointments_updated on appointments;
create trigger trg_appointments_updated before update on appointments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- سجل النشاط (للمسؤول)
-- ---------------------------------------------------------------------
create table if not exists activity_log (
  id          bigserial primary key,
  actor_id    uuid,
  actor_name  text,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  entity_name text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_entity_idx  on activity_log (entity_type, entity_id, created_at desc);
create index if not exists activity_created_idx on activity_log (created_at desc);

-- ---------------------------------------------------------------------
-- الإعدادات
-- ---------------------------------------------------------------------
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values
  ('warning_missed_threshold', '2'::jsonb),     -- عدد مرات عدم الالتزام خلال 30 يوم ليصبح الطالب تحت التحذير
  ('warning_inactive_days',    '14'::jsonb),    -- عدد الأيام بدون تسميع ليصبح الطالب تحت التحذير
  ('exam_pass_grade',          '60'::jsonb),    -- علامة النجاح في امتحان السورة
  ('work_start',               '"06:00"'::jsonb),
  ('work_end',                 '"22:00"'::jsonb),
  ('recitation_minutes',       '30'::jsonb),
  ('exam_minutes',             '45'::jsonb),
  ('juz_pages',                '20'::jsonb)     -- عدد صفحات الجزء الواحد (مصحف المدينة = 20)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- الأمان: تفعيل RLS بدون أي سياسة = ممنوع الوصول عبر واجهة Supabase العامة (anon key).
-- السيرفر يتصل مباشرة بصلاحية مالك الجداول فلا يتأثر بهذا.
-- ---------------------------------------------------------------------
alter table users            enable row level security;
alter table supervisors      enable row level security;
alter table students         enable row level security;
alter table student_warnings enable row level security;
alter table appointments     enable row level security;
alter table activity_log     enable row level security;
alter table settings         enable row level security;
