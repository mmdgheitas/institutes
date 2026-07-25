-- =============================================================================
-- 0001_init.sql — core schema, enums, PostGIS geography column + GIST index
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy name search

-- ----------------------------------------------------------------- enums --

CREATE TYPE user_role            AS ENUM ('STUDENT','TEACHER','INSTITUTE_ADMIN','SUPER_ADMIN');
CREATE TYPE verification_status  AS ENUM ('UNVERIFIED','PENDING','VERIFIED','REJECTED');
CREATE TYPE course_type          AS ENUM ('ONLINE','IN_PERSON','HYBRID');
CREATE TYPE course_level         AS ENUM ('BEGINNER','INTERMEDIATE','ADVANCED','ALL_LEVELS');
CREATE TYPE lead_status          AS ENUM ('NEW','CONTACTED','INTERVIEWED','ENROLLED','CANCELLED');
CREATE TYPE question_type        AS ENUM ('MULTIPLE_CHOICE','MULTI_SELECT','TRUE_FALSE','SHORT_ANSWER','ESSAY','FILE_UPLOAD');
CREATE TYPE attempt_status       AS ENUM ('IN_PROGRESS','SUBMITTED','AUTO_SUBMITTED','GRADED','VOIDED');
CREATE TYPE enrollment_status    AS ENUM ('ACTIVE','COMPLETED','DROPPED','SUSPENDED');
CREATE TYPE transaction_type     AS ENUM ('ENROLLMENT_REVENUE','PLATFORM_COMMISSION','PAYOUT','REFUND','ADJUSTMENT');
CREATE TYPE payout_status        AS ENUM ('NONE','REQUESTED','APPROVED','PAID','REJECTED');
CREATE TYPE media_kind           AS ENUM ('IMAGE','VIDEO','AUDIO','DOCUMENT','PANORAMA_360');
CREATE TYPE media_status         AS ENUM ('PENDING_UPLOAD','UPLOADED','PROCESSING','READY','FAILED');
CREATE TYPE live_class_provider  AS ENUM ('ADOBE_CONNECT','BIG_BLUE_BUTTON');
CREATE TYPE booking_status       AS ENUM ('AVAILABLE','BOOKED','CANCELLED','COMPLETED');

-- --------------------------------------------------------- shared helper --

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------- users --

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           varchar(20)  NOT NULL UNIQUE,
  email           varchar(160) UNIQUE,
  password_hash   varchar(255),
  full_name       varchar(120) NOT NULL,
  role            user_role    NOT NULL DEFAULT 'STUDENT',
  avatar_url      varchar(500),
  is_active       boolean      NOT NULL DEFAULT true,
  phone_verified  boolean      NOT NULL DEFAULT false,
  last_login_at   timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX users_role_idx       ON users (role);
CREATE INDEX users_created_at_idx ON users (created_at DESC);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  varchar(255) NOT NULL UNIQUE,
  expires_at  timestamptz  NOT NULL,
  revoked_at  timestamptz,
  user_agent  varchar(300),
  ip_address  varchar(64),
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx    ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);

CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  phone       varchar(20) NOT NULL,
  code_hash   varchar(255) NOT NULL,
  purpose     varchar(40)  NOT NULL,
  expires_at  timestamptz  NOT NULL,
  consumed_at timestamptz,
  attempts    integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_phone_purpose_idx ON otp_codes (phone, purpose);
CREATE INDEX otp_codes_expires_idx       ON otp_codes (expires_at);

-- ------------------------------------------------------------ categories --

CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       varchar(60) NOT NULL UNIQUE,
  name       varchar(80) NOT NULL,
  name_fa    varchar(80),
  icon       varchar(40) NOT NULL DEFAULT 'graduation-cap',
  color      varchar(9)  NOT NULL DEFAULT '#2563eb',
  position   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------ institutes --

CREATE TABLE institutes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  varchar(120) NOT NULL UNIQUE,
  name                  varchar(160) NOT NULL,
  description           text,
  short_description     varchar(300),
  logo_url              varchar(500),
  cover_image_url       varchar(500),
  phone                 varchar(30),
  email                 varchar(160),
  website               varchar(255),
  address               varchar(400) NOT NULL,
  city                  varchar(80)  NOT NULL,
  province              varchar(80),
  postal_code           varchar(20),
  latitude              double precision NOT NULL,
  longitude             double precision NOT NULL,
  -- Maintained by trigger from latitude/longitude. Source of truth for search.
  location              geography(Point, 4326),
  rating                double precision NOT NULL DEFAULT 0,
  review_count          integer      NOT NULL DEFAULT 0,
  verification_status   verification_status NOT NULL DEFAULT 'UNVERIFIED',
  verified_at           timestamptz,
  is_active             boolean      NOT NULL DEFAULT true,
  is_published          boolean      NOT NULL DEFAULT false,
  free_pre_registration boolean      NOT NULL DEFAULT true,
  commission_percent    double precision NOT NULL DEFAULT 10,
  skills                text[]       NOT NULL DEFAULT '{}',
  amenities             text[]       NOT NULL DEFAULT '{}',
  working_hours         jsonb,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT institutes_lat_chk    CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT institutes_lng_chk    CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT institutes_rating_chk CHECK (rating BETWEEN 0 AND 5),
  CONSTRAINT institutes_commission_chk CHECK (commission_percent BETWEEN 0 AND 100)
);

-- Keep the geography column in sync with the scalar lat/lng columns so that
-- application code only ever writes plain numbers.
CREATE OR REPLACE FUNCTION institutes_sync_location() RETURNS trigger AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER institutes_sync_location_trg
  BEFORE INSERT OR UPDATE OF latitude, longitude ON institutes
  FOR EACH ROW EXECUTE FUNCTION institutes_sync_location();

CREATE TRIGGER institutes_updated_at BEFORE UPDATE ON institutes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sub-10ms radius/bbox queries.
CREATE INDEX institutes_location_gix ON institutes USING GIST (location);
CREATE INDEX institutes_city_idx     ON institutes (city);
CREATE INDEX institutes_status_idx   ON institutes (verification_status);
CREATE INDEX institutes_rating_idx   ON institutes (rating DESC);
CREATE INDEX institutes_live_idx     ON institutes (is_published, is_active);
CREATE INDEX institutes_skills_gin   ON institutes USING GIN (skills);
CREATE INDEX institutes_name_trgm    ON institutes USING GIN (name gin_trgm_ops);

CREATE TABLE institute_categories (
  institute_id uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  category_id  uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (institute_id, category_id)
);
CREATE INDEX institute_categories_category_idx ON institute_categories (category_id);

CREATE TABLE institute_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         user_role NOT NULL DEFAULT 'INSTITUTE_ADMIN',
  is_owner     boolean   NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institute_id, user_id)
);
CREATE INDEX institute_members_user_idx ON institute_members (user_id);

CREATE TABLE media (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id     uuid REFERENCES institutes(id) ON DELETE CASCADE,
  uploader_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  kind             media_kind   NOT NULL,
  status           media_status NOT NULL DEFAULT 'PENDING_UPLOAD',
  purpose          varchar(40)  NOT NULL,
  object_key       varchar(500) NOT NULL UNIQUE,
  url              varchar(700),
  thumbnail_url    varchar(700),
  hls_url          varchar(700),
  mime_type        varchar(120) NOT NULL,
  size_bytes       bigint,
  duration_seconds integer,
  width            integer,
  height           integer,
  title            varchar(200),
  position         integer      NOT NULL DEFAULT 0,
  is_public        boolean      NOT NULL DEFAULT false,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX media_institute_purpose_idx ON media (institute_id, purpose);
CREATE INDEX media_status_idx            ON media (status);
CREATE TRIGGER media_updated_at BEFORE UPDATE ON media
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE verification_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  media_id     uuid REFERENCES media(id) ON DELETE SET NULL,
  doc_type     varchar(60) NOT NULL,
  status       verification_status NOT NULL DEFAULT 'PENDING',
  review_note  text,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_documents_institute_idx ON verification_documents (institute_id);

CREATE TABLE instructors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id        uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  user_id             uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  full_name           varchar(120) NOT NULL,
  headline            varchar(200),
  bio                 text,
  avatar_url          varchar(500),
  years_of_experience integer,
  specialties         text[] NOT NULL DEFAULT '{}',
  rating              double precision NOT NULL DEFAULT 0,
  review_count        integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX instructors_institute_idx ON instructors (institute_id);
CREATE TRIGGER instructors_updated_at BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------- courses --

CREATE TABLE courses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id     uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  category_id      uuid REFERENCES categories(id) ON DELETE SET NULL,
  slug             varchar(140) NOT NULL,
  title            varchar(200) NOT NULL,
  description      text,
  type             course_type  NOT NULL DEFAULT 'IN_PERSON',
  level            course_level NOT NULL DEFAULT 'ALL_LEVELS',
  price            numeric(12,2) NOT NULL DEFAULT 0,
  discount_percent double precision NOT NULL DEFAULT 0,
  currency         varchar(8)   NOT NULL DEFAULT 'IRR',
  duration_hours   integer      NOT NULL DEFAULT 0,
  capacity         integer      NOT NULL DEFAULT 20,
  enrolled_count   integer      NOT NULL DEFAULT 0,
  start_date       timestamptz,
  end_date         timestamptz,
  schedule         jsonb        NOT NULL DEFAULT '[]'::jsonb,
  is_published     boolean      NOT NULL DEFAULT false,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (institute_id, slug),
  CONSTRAINT courses_price_chk    CHECK (price >= 0),
  CONSTRAINT courses_discount_chk CHECK (discount_percent BETWEEN 0 AND 100),
  CONSTRAINT courses_capacity_chk CHECK (capacity >= 0),
  CONSTRAINT courses_enrolled_chk CHECK (enrolled_count >= 0)
);
CREATE INDEX courses_institute_pub_idx ON courses (institute_id, is_published);
CREATE INDEX courses_type_idx          ON courses (type);
CREATE INDEX courses_price_idx         ON courses (price);
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE course_instructors (
  course_id     uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, instructor_id)
);
CREATE INDEX course_instructors_instructor_idx ON course_instructors (instructor_id);

CREATE TABLE classrooms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  name         varchar(80) NOT NULL,
  capacity     integer NOT NULL DEFAULT 20,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institute_id, name)
);

CREATE TABLE timetable_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  day_of_week  integer NOT NULL,
  start_time   varchar(5) NOT NULL,
  end_time     varchar(5) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timetable_dow_chk  CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT timetable_time_chk CHECK (start_time < end_time)
);
CREATE INDEX timetable_course_idx    ON timetable_entries (course_id);
CREATE INDEX timetable_classroom_idx ON timetable_entries (classroom_id, day_of_week);

-- ------------------------------------------------- forms and submissions --

CREATE TABLE forms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id      uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  title             varchar(160) NOT NULL,
  description       text,
  is_active         boolean NOT NULL DEFAULT true,
  requires_contract boolean NOT NULL DEFAULT false,
  contract_text     text,
  requires_otp      boolean NOT NULL DEFAULT false,
  fields            jsonb   NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forms_institute_active_idx ON forms (institute_id, is_active);
CREATE TRIGGER forms_updated_at BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE submissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id              uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  institute_id         uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  course_id            uuid REFERENCES courses(id) ON DELETE SET NULL,
  student_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status               lead_status NOT NULL DEFAULT 'NEW',
  data                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  note                 text,
  contract_accepted_at timestamptz,
  contract_ip          varchar(64),
  contract_user_agent  varchar(300),
  sms_confirmed_at     timestamptz,
  board_position       integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submissions_institute_status_idx ON submissions (institute_id, status, board_position);
CREATE INDEX submissions_student_idx          ON submissions (student_id);
CREATE INDEX submissions_created_idx          ON submissions (created_at DESC);
-- One open lead per student per form; re-application allowed after cancellation.
CREATE UNIQUE INDEX submissions_open_lead_uidx
  ON submissions (form_id, student_id)
  WHERE status <> 'CANCELLED';
CREATE TRIGGER submissions_updated_at BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE submission_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  from_status   lead_status,
  to_status     lead_status NOT NULL,
  actor_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submission_events_submission_idx ON submission_events (submission_id, created_at DESC);

CREATE TABLE time_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  course_id    uuid REFERENCES courses(id) ON DELETE SET NULL,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  capacity     integer NOT NULL DEFAULT 1,
  booked_count integer NOT NULL DEFAULT 0,
  status       booking_status NOT NULL DEFAULT 'AVAILABLE',
  location     varchar(200),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_slots_range_chk    CHECK (starts_at < ends_at),
  CONSTRAINT time_slots_capacity_chk CHECK (booked_count >= 0 AND booked_count <= capacity)
);
CREATE INDEX time_slots_institute_start_idx ON time_slots (institute_id, starts_at);

CREATE TABLE slot_bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       uuid NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id uuid UNIQUE REFERENCES submissions(id) ON DELETE SET NULL,
  status        booking_status NOT NULL DEFAULT 'BOOKED',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, student_id)
);
CREATE INDEX slot_bookings_student_idx ON slot_bookings (student_id);

CREATE TABLE enrollments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id    uuid UNIQUE REFERENCES submissions(id) ON DELETE SET NULL,
  status           enrollment_status NOT NULL DEFAULT 'ACTIVE',
  progress_percent double precision NOT NULL DEFAULT 0,
  price_paid       numeric(12,2) NOT NULL DEFAULT 0,
  enrolled_at      timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  UNIQUE (course_id, student_id),
  CONSTRAINT enrollments_progress_chk CHECK (progress_percent BETWEEN 0 AND 100)
);
CREATE INDEX enrollments_student_idx ON enrollments (student_id, status);

-- ------------------------------------------------------------------- LMS --

CREATE TABLE quizzes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title              varchar(200) NOT NULL,
  description        text,
  time_limit_seconds integer NOT NULL DEFAULT 1800,
  max_score          double precision NOT NULL DEFAULT 100,
  passing_score      double precision NOT NULL DEFAULT 50,
  shuffle_questions  boolean NOT NULL DEFAULT true,
  shuffle_options    boolean NOT NULL DEFAULT true,
  anti_cheat_enabled boolean NOT NULL DEFAULT true,
  max_focus_losses   integer NOT NULL DEFAULT 3,
  attempts_allowed   integer NOT NULL DEFAULT 1,
  opens_at           timestamptz,
  closes_at          timestamptz,
  is_published       boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quizzes_time_limit_chk CHECK (time_limit_seconds BETWEEN 30 AND 86400),
  CONSTRAINT quizzes_attempts_chk   CHECK (attempts_allowed >= 1)
);
CREATE INDEX quizzes_course_pub_idx ON quizzes (course_id, is_published);
CREATE TRIGGER quizzes_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE quiz_questions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id            uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  type               question_type NOT NULL,
  prompt             text NOT NULL,
  points             double precision NOT NULL DEFAULT 1,
  options            jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option_ids text[] NOT NULL DEFAULT '{}',
  correct_text       varchar(500),
  explanation        text,
  allowed_mime_types text[] NOT NULL DEFAULT '{}',
  position           integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_questions_points_chk CHECK (points > 0)
);
CREATE INDEX quiz_questions_quiz_pos_idx ON quiz_questions (quiz_id, position);

CREATE TABLE quiz_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id          uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  started_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  submitted_at     timestamptz,
  graded_at        timestamptz,
  graded_by_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  score            double precision,
  max_score        double precision NOT NULL DEFAULT 0,
  focus_loss_count integer NOT NULL DEFAULT 0,
  question_order   text[] NOT NULL DEFAULT '{}',
  option_order     jsonb,
  sync_version     integer NOT NULL DEFAULT 0,
  ip_address       varchar(64)
);
CREATE INDEX quiz_attempts_quiz_student_idx ON quiz_attempts (quiz_id, student_id);
CREATE INDEX quiz_attempts_status_exp_idx   ON quiz_attempts (status, expires_at);
-- Only one live attempt per student per quiz.
CREATE UNIQUE INDEX quiz_attempts_single_active_uidx
  ON quiz_attempts (quiz_id, student_id)
  WHERE status = 'IN_PROGRESS';

CREATE TABLE quiz_answers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id         uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id        uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  value              jsonb NOT NULL,
  awarded_points     double precision,
  is_correct         boolean,
  needs_manual_grade boolean NOT NULL DEFAULT false,
  feedback           text,
  client_updated_at  timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX quiz_answers_attempt_idx ON quiz_answers (attempt_id);

CREATE TABLE study_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  media_id        uuid REFERENCES media(id) ON DELETE SET NULL,
  title           varchar(200) NOT NULL,
  description     text,
  kind            media_kind NOT NULL DEFAULT 'DOCUMENT',
  is_downloadable boolean NOT NULL DEFAULT true,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_materials_course_idx ON study_materials (course_id, position);

CREATE TABLE live_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id    uuid REFERENCES instructors(id) ON DELETE SET NULL,
  provider         live_class_provider NOT NULL DEFAULT 'BIG_BLUE_BUTTON',
  title            varchar(200) NOT NULL,
  external_room_id varchar(200),
  moderator_pw     varchar(120),
  attendee_pw      varchar(120),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  recording_url    varchar(500),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_sessions_range_chk CHECK (starts_at < ends_at)
);
CREATE INDEX live_sessions_course_start_idx ON live_sessions (course_id, starts_at);

-- --------------------------------------------------------------- reviews --

CREATE TABLE reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id    uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating          integer NOT NULL,
  title           varchar(160),
  body            text NOT NULL,
  video_media_id  uuid REFERENCES media(id) ON DELETE SET NULL,
  institute_reply text,
  replied_at      timestamptz,
  is_published    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institute_id, author_id),
  CONSTRAINT reviews_rating_chk CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX reviews_institute_pub_idx ON reviews (institute_id, is_published);
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keep institutes.rating / review_count denormalized for fast map queries.
CREATE OR REPLACE FUNCTION reviews_refresh_institute_rating() RETURNS trigger AS $$
DECLARE
  target uuid := COALESCE(NEW.institute_id, OLD.institute_id);
BEGIN
  UPDATE institutes i
     SET rating = COALESCE(agg.avg_rating, 0),
         review_count = COALESCE(agg.cnt, 0)
    FROM (
      SELECT AVG(rating)::double precision AS avg_rating, COUNT(*) AS cnt
        FROM reviews
       WHERE institute_id = target AND is_published
    ) agg
   WHERE i.id = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_refresh_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION reviews_refresh_institute_rating();

-- -------------------------------------------------------------- finances --

CREATE TABLE payout_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  amount       numeric(14,2) NOT NULL,
  status       payout_status NOT NULL DEFAULT 'REQUESTED',
  iban         varchar(34),
  note         text,
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_requests_amount_chk CHECK (amount > 0)
);
CREATE INDEX payout_requests_institute_idx ON payout_requests (institute_id, status);

CREATE TABLE wallet_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id      uuid NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  amount            numeric(14,2) NOT NULL,
  type              transaction_type NOT NULL,
  payout_status     payout_status NOT NULL DEFAULT 'NONE',
  description       varchar(300),
  reference_id      varchar(120),
  payout_request_id uuid REFERENCES payout_requests(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_transactions_institute_idx ON wallet_transactions (institute_id, created_at DESC);
CREATE INDEX wallet_transactions_type_idx      ON wallet_transactions (type);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      varchar(200) NOT NULL,
  body       text NOT NULL,
  kind       varchar(40) NOT NULL DEFAULT 'SYSTEM',
  link_url   varchar(500),
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, read_at);
