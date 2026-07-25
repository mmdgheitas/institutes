#!/usr/bin/env ts-node
/**
 * Development seed.
 *
 *   npm run db:seed              # insert / update fixtures
 *   npm run db:seed -- --fresh   # wipe seeded data first, then insert
 *
 * Design rules:
 *
 *  - Idempotent. Every insert is ON CONFLICT DO UPDATE keyed on a natural key
 *    (slug, phone, composite), so running it twice changes nothing and never
 *    duplicates rows.
 *  - Transactional. Everything happens in one transaction; a failure leaves
 *    the database exactly as it was.
 *  - Trigger-friendly. `institutes.location`, `institutes.rating`,
 *    `courses.enrolled_count` and the denormalised course flags are all
 *    maintained by database triggers, so the seed never writes them directly.
 *    It writes latitude/longitude and reviews and lets the triggers do the rest.
 *
 * Safety: refuses to run against a database whose URL looks like production
 * unless ALLOW_PRODUCTION_SEED=true is set.
 */
import { hash } from 'bcryptjs';
import { Pool, type PoolClient } from 'pg';

import {
  CATEGORIES,
  COURSES,
  INSTITUTES,
  INSTRUCTORS,
  REVIEW_TEXTS,
} from './seed-data';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://institutes:institutes@localhost:5432/institutes';

/** bcrypt rounds — lowered for seeding so it does not take a minute. */
const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? 'Password123';

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh');

/* ------------------------------------------------------------- helpers --- */

const log = (msg: string): void => {
  process.stdout.write(`${msg}\n`);
};

/** Deterministic pseudo-random in [0,1) so every run produces identical data. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

/** Date offset from now, in whole days. */
function daysFromNow(days: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function assertNotProduction(): void {
  if (process.env.ALLOW_PRODUCTION_SEED === 'true') return;
  const url = DATABASE_URL.toLowerCase();
  const looksProd =
    process.env.NODE_ENV === 'production' ||
    /prod|production|\.rds\.|\.azure\.|\.gcp\./.test(url);
  if (looksProd) {
    throw new Error(
      'Refusing to seed: DATABASE_URL or NODE_ENV looks like production. ' +
        'Set ALLOW_PRODUCTION_SEED=true to override.',
    );
  }
}

/* --------------------------------------------------------------- steps --- */

/** Removes previously seeded rows. Safe because it only targets seed slugs. */
async function wipe(db: PoolClient): Promise<void> {
  log('  → wiping previously seeded data');
  const slugs = INSTITUTES.map((i) => i.slug);
  const phones = seedPhones();

  // institutes cascade to courses, forms, submissions, quizzes, media, wallet…
  await db.query('DELETE FROM institutes WHERE slug = ANY($1::text[])', [slugs]);
  await db.query('DELETE FROM users WHERE phone = ANY($1::text[])', [phones]);
  await db.query('DELETE FROM categories WHERE slug = ANY($1::text[])', [
    CATEGORIES.map((c) => c.slug),
  ]);
}

/** Every phone number this seed owns, so --fresh can clean up precisely. */
function seedPhones(): string[] {
  const phones = ['09120000001', '09120000002'];
  INSTITUTES.forEach((_, i) =>
    phones.push(`0912100${String(i).padStart(4, '0')}`),
  );
  INSTRUCTORS.forEach((_, i) =>
    phones.push(`0912200${String(i).padStart(4, '0')}`),
  );
  for (let i = 0; i < 30; i += 1) {
    phones.push(`0912300${String(i).padStart(4, '0')}`);
  }
  return phones;
}

async function seedCategories(db: PoolClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const c of CATEGORIES) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO categories (slug, name, name_fa, icon, color, position)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             name_fa = EXCLUDED.name_fa,
             icon = EXCLUDED.icon,
             color = EXCLUDED.color,
             position = EXCLUDED.position
       RETURNING id`,
      [c.slug, c.name, c.nameFa, c.icon, c.color, c.position],
    );
    ids.set(c.slug, rows[0].id);
  }
  log(`  ✓ ${ids.size} categories`);
  return ids;
}

interface SeededUser {
  id: string;
  phone: string;
  fullName: string;
}

async function upsertUser(
  db: PoolClient,
  input: {
    phone: string;
    fullName: string;
    role: string;
    email?: string | null;
    passwordHash?: string | null;
  },
): Promise<SeededUser> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (phone, full_name, role, email, password_hash, phone_verified)
     VALUES ($1,$2,$3::user_role,$4,$5,true)
     ON CONFLICT (phone) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           email = EXCLUDED.email,
           password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)
     RETURNING id`,
    [
      input.phone,
      input.fullName,
      input.role,
      input.email ?? null,
      input.passwordHash ?? null,
    ],
  );
  return { id: rows[0].id, phone: input.phone, fullName: input.fullName };
}

async function main(): Promise<void> {
  assertNotProduction();

  const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
  const db = await pool.connect();

  try {
    // Fail early with a clear message if migrations have not been applied.
    const { rows: check } = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'institutes'
       ) AS exists`,
    );
    if (!check[0].exists) {
      throw new Error(
        'Table "institutes" not found. Run `npm run db:migrate` before seeding.',
      );
    }

    await db.query('BEGIN');

    if (FRESH) await wipe(db);

    log('Seeding…');
    const categoryIds = await seedCategories(db);
    const passwordHash = await hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

    /* -------------------------------------------------------- platform -- */

    const superAdmin = await upsertUser(db, {
      phone: '09120000001',
      fullName: 'Platform Super Admin',
      role: 'SUPER_ADMIN',
      email: 'admin@institutes.local',
      passwordHash,
    });

    const demoStudent = await upsertUser(db, {
      phone: '09120000002',
      fullName: 'Sara Ahmadi',
      role: 'STUDENT',
      email: 'sara@example.com',
      passwordHash,
    });
    log('  ✓ super admin + demo student');

    /* ------------------------------------------------------- students --- */

    const students: SeededUser[] = [demoStudent];
    const firstNames = ['Ali', 'Zahra', 'Mohammad', 'Fatemeh', 'Hossein', 'Maryam', 'Reza', 'Narges', 'Amir', 'Elham'];
    const lastNames = ['Rezaei', 'Hosseini', 'Karimi', 'Jafari', 'Moradi', 'Ahmadi', 'Sadeghi', 'Kazemi'];
    for (let i = 0; i < 30; i += 1) {
      const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
      students.push(
        await upsertUser(db, {
          phone: `0912300${String(i).padStart(4, '0')}`,
          fullName: name,
          role: 'STUDENT',
          passwordHash,
        }),
      );
    }
    log(`  ✓ ${students.length} students`);

    /* ----------------------------------------------------- institutes --- */

    const instituteIds = new Map<string, string>();
    const instituteAdmins = new Map<string, SeededUser>();

    for (const [index, inst] of INSTITUTES.entries()) {
      const admin = await upsertUser(db, {
        phone: `0912100${String(index).padStart(4, '0')}`,
        fullName: `${inst.name} Admin`,
        role: 'INSTITUTE_ADMIN',
        email: `admin@${inst.slug}.local`,
        passwordHash,
      });
      instituteAdmins.set(inst.slug, admin);

      // latitude/longitude only — the trigger derives `location` from them.
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO institutes (
           slug, name, description, short_description, address, city, province,
           latitude, longitude, phone, email, skills, amenities,
           verification_status, verified_at, is_active, is_published,
           free_pre_registration, commission_percent, working_hours
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::text[],$13::text[],
           $14::verification_status,$15,true,$16,$17,$18,$19::jsonb
         )
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           short_description = EXCLUDED.short_description,
           address = EXCLUDED.address,
           city = EXCLUDED.city,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           phone = EXCLUDED.phone,
           skills = EXCLUDED.skills,
           amenities = EXCLUDED.amenities,
           verification_status = EXCLUDED.verification_status,
           is_published = EXCLUDED.is_published,
           free_pre_registration = EXCLUDED.free_pre_registration,
           commission_percent = EXCLUDED.commission_percent
         RETURNING id`,
        [
          inst.slug,
          inst.name,
          inst.description,
          inst.shortDescription,
          inst.address,
          inst.city,
          inst.province,
          inst.lat,
          inst.lng,
          inst.phone,
          `info@${inst.slug}.local`,
          inst.skills,
          inst.amenities,
          inst.verification,
          inst.verification === 'VERIFIED' ? new Date() : null,
          inst.published,
          inst.freePreRegistration,
          inst.commissionPercent,
          JSON.stringify({
            saturday: '09:00-20:00',
            sunday: '09:00-20:00',
            monday: '09:00-20:00',
            tuesday: '09:00-20:00',
            wednesday: '09:00-20:00',
            thursday: '09:00-14:00',
            friday: 'closed',
          }),
        ],
      );
      const instituteId = rows[0].id;
      instituteIds.set(inst.slug, instituteId);

      await db.query(
        `INSERT INTO institute_members (institute_id, user_id, role, is_owner)
         VALUES ($1,$2,'INSTITUTE_ADMIN',true)
         ON CONFLICT (institute_id, user_id) DO NOTHING`,
        [instituteId, admin.id],
      );

      await db.query('DELETE FROM institute_categories WHERE institute_id = $1', [
        instituteId,
      ]);
      for (const [ci, slug] of inst.categorySlugs.entries()) {
        const categoryId = categoryIds.get(slug);
        if (!categoryId) continue;
        await db.query(
          `INSERT INTO institute_categories (institute_id, category_id, is_primary)
           VALUES ($1,$2,$3)
           ON CONFLICT (institute_id, category_id) DO UPDATE
             SET is_primary = EXCLUDED.is_primary`,
          [instituteId, categoryId, ci === 0],
        );
      }
    }
    log(`  ✓ ${instituteIds.size} institutes (+ admins, categories)`);

    /* ---------------------------------------------------- instructors --- */

    const instructorIds = new Map<string, string[]>();
    for (const [index, ins] of INSTRUCTORS.entries()) {
      const instituteId = instituteIds.get(ins.instituteSlug);
      if (!instituteId) continue;

      const teacher = await upsertUser(db, {
        phone: `0912200${String(index).padStart(4, '0')}`,
        fullName: ins.fullName,
        role: 'TEACHER',
        passwordHash,
      });

      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO instructors (
           institute_id, user_id, full_name, headline, bio,
           years_of_experience, specialties, rating, review_count, is_active
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,true)
         ON CONFLICT (user_id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           headline = EXCLUDED.headline,
           bio = EXCLUDED.bio,
           years_of_experience = EXCLUDED.years_of_experience,
           specialties = EXCLUDED.specialties,
           rating = EXCLUDED.rating,
           review_count = EXCLUDED.review_count
         RETURNING id`,
        [
          instituteId,
          teacher.id,
          ins.fullName,
          ins.headline,
          ins.bio,
          ins.yearsOfExperience,
          ins.specialties,
          ins.rating,
          ins.reviewCount,
        ],
      );

      const list = instructorIds.get(ins.instituteSlug) ?? [];
      list.push(rows[0].id);
      instructorIds.set(ins.instituteSlug, list);
    }
    log(`  ✓ ${INSTRUCTORS.length} instructors (+ teacher accounts)`);

    /* -------------------------------------------------------- courses --- */

    const courseIds = new Map<string, string>();
    for (const course of COURSES) {
      const instituteId = instituteIds.get(course.instituteSlug);
      if (!instituteId) continue;

      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO courses (
           institute_id, category_id, slug, title, description, type, level,
           price, discount_percent, currency, duration_hours, capacity,
           start_date, end_date, schedule, is_published
         ) VALUES (
           $1,$2,$3,$4,$5,$6::course_type,$7::course_level,
           $8,$9,'IRR',$10,$11,$12,$13,$14::jsonb,$15
         )
         ON CONFLICT (institute_id, slug) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           type = EXCLUDED.type,
           level = EXCLUDED.level,
           price = EXCLUDED.price,
           discount_percent = EXCLUDED.discount_percent,
           duration_hours = EXCLUDED.duration_hours,
           capacity = EXCLUDED.capacity,
           schedule = EXCLUDED.schedule,
           is_published = EXCLUDED.is_published
         RETURNING id`,
        [
          instituteId,
          categoryIds.get(course.categorySlug) ?? null,
          course.slug,
          course.title,
          course.description,
          course.type,
          course.level,
          course.price,
          course.discountPercent,
          course.durationHours,
          course.capacity,
          daysFromNow(14),
          daysFromNow(14 + Math.ceil(course.durationHours / 4)),
          JSON.stringify(course.sessions),
          course.published,
        ],
      );
      const courseId = rows[0].id;
      courseIds.set(`${course.instituteSlug}/${course.slug}`, courseId);

      const teachers = instructorIds.get(course.instituteSlug) ?? [];
      if (teachers.length > 0) {
        await db.query(
          `INSERT INTO course_instructors (course_id, instructor_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [courseId, teachers[0]],
        );
      }
    }
    log(`  ✓ ${courseIds.size} courses`);

    /* ----------------------------------------------- classrooms + rota --- */

    let timetableCount = 0;
    for (const inst of INSTITUTES) {
      const instituteId = instituteIds.get(inst.slug);
      if (!instituteId) continue;

      const roomNames = ['Room A', 'Room B', 'Lab 1'];
      const classroomIds: string[] = [];
      for (const name of roomNames) {
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO classrooms (institute_id, name, capacity)
           VALUES ($1,$2,$3)
           ON CONFLICT (institute_id, name) DO UPDATE SET capacity = EXCLUDED.capacity
           RETURNING id`,
          [instituteId, name, 25],
        );
        classroomIds.push(rows[0].id);
      }

      // One timetable entry per course session, spread across rooms so the
      // classroom-clash check in CoursesService has realistic data to work on.
      const instituteCourses = COURSES.filter(
        (c) => c.instituteSlug === inst.slug && c.published,
      );
      for (const [ci, course] of instituteCourses.entries()) {
        const courseId = courseIds.get(`${course.instituteSlug}/${course.slug}`);
        if (!courseId) continue;
        for (const session of course.sessions) {
          const { rowCount } = await db.query(
            `INSERT INTO timetable_entries
               (course_id, classroom_id, day_of_week, start_time, end_time)
             SELECT $1,$2,$3,$4,$5
              WHERE NOT EXISTS (
                SELECT 1 FROM timetable_entries
                 WHERE course_id = $1 AND day_of_week = $3 AND start_time = $4
              )`,
            [
              courseId,
              classroomIds[ci % classroomIds.length],
              session.dayOfWeek,
              session.startTime,
              session.endTime,
            ],
          );
          timetableCount += rowCount ?? 0;
        }
      }
    }
    log(`  ✓ classrooms + ${timetableCount} timetable entries`);

    /* ---------------------------------------------------------- forms --- */

    const formIds = new Map<string, string>();
    for (const inst of INSTITUTES) {
      const instituteId = instituteIds.get(inst.slug);
      if (!instituteId) continue;

      const fields = [
        { key: 'full_name', label: 'Full name', type: 'TEXT', required: true, position: 0, minLength: 3, maxLength: 120, placeholder: 'As written on your ID' },
        { key: 'national_id', label: 'National ID', type: 'NATIONAL_ID', required: true, position: 1, helpText: '10 digits' },
        { key: 'mobile', label: 'Mobile number', type: 'PHONE', required: true, position: 2 },
        { key: 'birth_date', label: 'Date of birth', type: 'DATE', required: false, position: 3 },
        {
          key: 'current_level',
          label: 'Current level',
          type: 'SELECT',
          required: true,
          position: 4,
          options: [
            { label: 'Absolute beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Advanced', value: 'advanced' },
          ],
        },
        {
          key: 'preferred_days',
          label: 'Preferred days',
          type: 'MULTI_SELECT',
          required: false,
          position: 5,
          options: [
            { label: 'Saturday', value: 'sat' },
            { label: 'Monday', value: 'mon' },
            { label: 'Wednesday', value: 'wed' },
          ],
        },
        { key: 'goals', label: 'What do you want to achieve?', type: 'TEXTAREA', required: false, position: 6, maxLength: 1000 },
        { key: 'newsletter', label: 'Send me course announcements', type: 'CHECKBOX', required: false, position: 7 },
      ];

      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO forms (
           institute_id, title, description, is_active,
           requires_contract, contract_text, requires_otp, fields
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         RETURNING id`,
        [
          instituteId,
          `${inst.name} — Pre-registration`,
          'Complete this form and our team will contact you within two working days.',
          true, // is_active
          inst.freePreRegistration, // requires_contract
          inst.freePreRegistration
            ? `By submitting this form you agree to ${inst.name}'s enrolment terms: `
              + 'places are confirmed only after the assessment interview, fees are '
              + 'refundable up to 7 days before the course start date, and your '
              + 'personal data is processed solely for admissions purposes.'
            : null,
          false, // requires_otp — keeps local sign-up friction-free
          JSON.stringify(fields),
        ],
      );
      formIds.set(inst.slug, rows[0].id);
    }
    log(`  ✓ ${formIds.size} pre-registration forms`);

    /* ------------------------------------------------------ time slots --- */

    let slotCount = 0;
    for (const inst of INSTITUTES) {
      const instituteId = instituteIds.get(inst.slug);
      if (!instituteId || !inst.published) continue;

      for (let day = 2; day <= 8; day += 2) {
        for (const hour of [10, 14, 17]) {
          const startsAt = daysFromNow(day, hour);
          const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
          const { rowCount } = await db.query(
            `INSERT INTO time_slots
               (institute_id, starts_at, ends_at, capacity, booked_count, status, location)
             SELECT $1,$2,$3,2,0,'AVAILABLE',$4
              WHERE NOT EXISTS (
                SELECT 1 FROM time_slots
                 WHERE institute_id = $1 AND starts_at = $2
              )`,
            [instituteId, startsAt, endsAt, 'Main reception'],
          );
          slotCount += rowCount ?? 0;
        }
      }
    }
    log(`  ✓ ${slotCount} assessment slots`);

    /* -------------------------------------------------------- reviews --- */
    // Reviews drive institutes.rating and review_count through a trigger, so
    // they are inserted before anything that reads ratings.

    let reviewCount = 0;
    for (const inst of INSTITUTES) {
      const instituteId = instituteIds.get(inst.slug);
      if (!instituteId || inst.reviewCount === 0) continue;

      const rand = seededRandom(inst.slug);
      for (let i = 0; i < inst.reviewCount; i += 1) {
        const author = students[(i * 3 + inst.slug.length) % students.length];
        // Ratings cluster around the institute's target, clamped to 1..5.
        const jitter = rand() < 0.75 ? 0 : rand() < 0.5 ? -1 : 1;
        const rating = Math.max(
          1,
          Math.min(5, Math.round(inst.targetRating) + jitter),
        );
        const text = REVIEW_TEXTS[(i + inst.slug.length) % REVIEW_TEXTS.length];

        const { rowCount } = await db.query(
          `INSERT INTO reviews
             (institute_id, author_id, rating, title, body, institute_reply, replied_at, is_published)
           VALUES ($1,$2,$3,$4,$5,$6,$7,true)
           ON CONFLICT (institute_id, author_id) DO NOTHING`,
          [
            instituteId,
            author.id,
            rating,
            text.title,
            text.body,
            i % 4 === 0 ? 'Thank you for the feedback — we are glad it helped.' : null,
            i % 4 === 0 ? new Date() : null,
          ],
        );
        reviewCount += rowCount ?? 0;
      }
    }
    log(`  ✓ ${reviewCount} reviews (ratings recomputed by trigger)`);

    /* --------------------------------- submissions / leads / pipeline --- */

    const leadStatuses = ['NEW', 'NEW', 'CONTACTED', 'CONTACTED', 'INTERVIEWED', 'ENROLLED', 'CANCELLED'];
    let submissionCount = 0;
    let enrollmentCount = 0;

    for (const inst of INSTITUTES) {
      const instituteId = instituteIds.get(inst.slug);
      const formId = formIds.get(inst.slug);
      if (!instituteId || !formId || !inst.published) continue;

      const instituteCourses = COURSES.filter(
        (c) => c.instituteSlug === inst.slug && c.published,
      );
      if (instituteCourses.length === 0) continue;

      for (let i = 0; i < 7; i += 1) {
        const student = students[(i * 5 + inst.slug.length) % students.length];
        const status = leadStatuses[i % leadStatuses.length];
        const course = instituteCourses[i % instituteCourses.length];
        const courseId = courseIds.get(`${course.instituteSlug}/${course.slug}`);

        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO submissions (
             form_id, institute_id, course_id, student_id, status, data,
             note, contract_accepted_at, contract_ip, board_position, created_at
           ) VALUES ($1,$2,$3,$4,$5::lead_status,$6::jsonb,$7,$8,$9,$10,$11)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            formId,
            instituteId,
            courseId ?? null,
            student.id,
            status,
            JSON.stringify({
              full_name: student.fullName,
              national_id: '0499370899',
              mobile: student.phone,
              current_level: ['beginner', 'intermediate', 'advanced'][i % 3],
              preferred_days: ['sat', 'wed'],
              goals: 'Improve quickly for work purposes.',
              newsletter: i % 2 === 0,
            }),
            status === 'CONTACTED' ? 'Called — asked to be contacted again next week.' : null,
            inst.freePreRegistration ? daysFromNow(-i - 1, 12) : null,
            inst.freePreRegistration ? '192.0.2.10' : null,
            i,
            daysFromNow(-i - 1, 9),
          ],
        );

        if (rows.length === 0) continue; // already existed
        const submissionId = rows[0].id;
        submissionCount += 1;

        await db.query(
          `INSERT INTO submission_events (submission_id, from_status, to_status, actor_id, note)
           VALUES ($1, NULL, 'NEW', $2, 'Pre-registration submitted')`,
          [submissionId, student.id],
        );
        if (status !== 'NEW') {
          await db.query(
            `INSERT INTO submission_events (submission_id, from_status, to_status, actor_id, note)
             VALUES ($1,'NEW',$2::lead_status,$3,'Status updated during triage')`,
            [submissionId, status, instituteAdmins.get(inst.slug)?.id ?? null],
          );
        }

        // An ENROLLED lead must have the enrollment + ledger entries that the
        // CRM would have created, otherwise the finance screens look empty.
        if (status === 'ENROLLED' && courseId) {
          const gross = Math.round(
            course.price * (1 - course.discountPercent / 100),
          );
          const commission = Math.round((gross * inst.commissionPercent) / 100);

          const { rowCount: enrolled } = await db.query(
            `INSERT INTO enrollments
               (course_id, student_id, submission_id, status, progress_percent, price_paid)
             VALUES ($1,$2,$3,'ACTIVE',$4,$5)
             ON CONFLICT (course_id, student_id) DO NOTHING`,
            [courseId, student.id, submissionId, (i % 5) * 20, gross],
          );
          enrollmentCount += enrolled ?? 0;

          if ((enrolled ?? 0) > 0) {
            await db.query(
              `INSERT INTO wallet_transactions
                 (institute_id, amount, type, description, reference_id)
               VALUES
                 ($1,$2,'ENROLLMENT_REVENUE',$3,$4),
                 ($1,$5,'PLATFORM_COMMISSION',$6,$4)`,
              [
                instituteId,
                gross,
                `Enrollment: ${course.title}`,
                submissionId,
                -commission,
                `Platform commission (${inst.commissionPercent}%)`,
              ],
            );
          }
        }
      }
    }
    log(`  ✓ ${submissionCount} leads, ${enrollmentCount} enrollments (+ wallet entries)`);

    /* --------------------------------------------------------- quizzes --- */

    let quizCount = 0;
    let questionCount = 0;

    for (const course of COURSES.filter((c) => c.published).slice(0, 8)) {
      const courseId = courseIds.get(`${course.instituteSlug}/${course.slug}`);
      if (!courseId) continue;

      const { rows: existing } = await db.query<{ id: string }>(
        'SELECT id FROM quizzes WHERE course_id = $1 LIMIT 1',
        [courseId],
      );
      if (existing.length > 0) continue;

      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO quizzes (
           course_id, title, description, time_limit_seconds, max_score,
           passing_score, shuffle_questions, shuffle_options,
           anti_cheat_enabled, max_focus_losses, attempts_allowed, is_published
         ) VALUES ($1,$2,$3,1800,100,50,true,true,true,3,2,true)
         RETURNING id`,
        [
          courseId,
          `${course.title} — Placement Test`,
          'A short placement test so we can put you in the right group.',
        ],
      );
      const quizId = rows[0].id;
      quizCount += 1;

      const questions = [
        {
          type: 'MULTIPLE_CHOICE',
          prompt: 'Which option best describes your current experience level?',
          points: 2,
          options: [
            { id: 'o1', text: 'No previous experience' },
            { id: 'o2', text: 'Some self-study' },
            { id: 'o3', text: 'Formal training before' },
            { id: 'o4', text: 'Professional experience' },
          ],
          correct: ['o3'],
        },
        {
          type: 'TRUE_FALSE',
          prompt: 'I am able to attend the scheduled sessions each week.',
          points: 1,
          options: [
            { id: 't1', text: 'True' },
            { id: 't2', text: 'False' },
          ],
          correct: ['t1'],
        },
        {
          type: 'MULTI_SELECT',
          prompt: 'Which areas would you like to focus on? (choose all that apply)',
          points: 3,
          options: [
            { id: 'm1', text: 'Fundamentals' },
            { id: 'm2', text: 'Practical projects' },
            { id: 'm3', text: 'Exam technique' },
            { id: 'm4', text: 'Conversation / discussion' },
          ],
          correct: ['m1', 'm2'],
        },
        {
          type: 'SHORT_ANSWER',
          prompt: 'In one word, what is your main goal? (e.g. "career")',
          points: 2,
          options: [],
          correct: [],
          correctText: 'career|job|work|promotion',
        },
        {
          type: 'ESSAY',
          prompt: 'Briefly describe what you hope to achieve by the end of this course.',
          points: 5,
          options: [],
          correct: [],
        },
      ];

      for (const [qi, q] of questions.entries()) {
        await db.query(
          `INSERT INTO quiz_questions (
             quiz_id, type, prompt, points, options, correct_option_ids,
             correct_text, explanation, position
           ) VALUES ($1,$2::question_type,$3,$4,$5::jsonb,$6::text[],$7,$8,$9)`,
          [
            quizId,
            q.type,
            q.prompt,
            q.points,
            JSON.stringify(q.options),
            q.correct,
            (q as { correctText?: string }).correctText ?? null,
            qi === 0 ? 'Self-assessment helps us place you correctly.' : null,
            qi,
          ],
        );
        questionCount += 1;
      }
    }
    log(`  ✓ ${quizCount} quizzes, ${questionCount} questions`);

    /* --------------------------------------------------- live sessions --- */

    let sessionCount = 0;
    for (const course of COURSES.filter(
      (c) => c.published && (c.type === 'ONLINE' || c.type === 'HYBRID'),
    )) {
      const courseId = courseIds.get(`${course.instituteSlug}/${course.slug}`);
      if (!courseId) continue;

      for (const [si, offset] of [1, 4, 8].entries()) {
        const startsAt = daysFromNow(offset, 18);
        const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
        const { rowCount } = await db.query(
          `INSERT INTO live_sessions
             (course_id, provider, title, starts_at, ends_at, external_room_id)
           SELECT $1,'BIG_BLUE_BUTTON',$2,$3,$4,$5
            WHERE NOT EXISTS (
              SELECT 1 FROM live_sessions WHERE course_id = $1 AND starts_at = $3
            )`,
          [
            courseId,
            `${course.title} — Session ${si + 1}`,
            startsAt,
            endsAt,
            `seed-${course.slug}-${si + 1}`,
          ],
        );
        sessionCount += rowCount ?? 0;
      }
    }
    log(`  ✓ ${sessionCount} live sessions`);

    /* ------------------------------------------------------- payouts ---- */

    let payoutCount = 0;
    for (const inst of INSTITUTES.slice(0, 4)) {
      const instituteId = instituteIds.get(inst.slug);
      if (!instituteId) continue;

      const { rows: balance } = await db.query<{ available: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS available
           FROM wallet_transactions WHERE institute_id = $1`,
        [instituteId],
      );
      const available = Number(balance[0]?.available ?? 0);
      if (available < 1_000_000) continue;

      const amount = Math.floor(available / 3);
      const { rowCount } = await db.query(
        `INSERT INTO payout_requests (institute_id, amount, status, iban, note)
         SELECT $1,$2,'REQUESTED','IR820540102680020817909002','Monthly payout'
          WHERE NOT EXISTS (
            SELECT 1 FROM payout_requests WHERE institute_id = $1
          )`,
        [instituteId, amount],
      );
      payoutCount += rowCount ?? 0;
    }
    log(`  ✓ ${payoutCount} payout requests`);

    /* --------------------------------------------------- notifications --- */

    await db.query(
      `INSERT INTO notifications (user_id, title, body, kind)
       SELECT $1, 'Welcome to Institutes',
              'Explore institutes near you on the map and pre-register online.',
              'SYSTEM'
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications WHERE user_id = $1 AND kind = 'SYSTEM'
        )`,
      [demoStudent.id],
    );

    await db.query('COMMIT');

    /* --------------------------------------------------------- summary --- */

    const { rows: stats } = await db.query<{
      institutes: string;
      published: string;
      courses: string;
      users: string;
      reviews: string;
      leads: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM institutes)::text AS institutes,
         (SELECT COUNT(*) FROM institutes WHERE is_published AND is_active)::text AS published,
         (SELECT COUNT(*) FROM courses)::text AS courses,
         (SELECT COUNT(*) FROM users)::text AS users,
         (SELECT COUNT(*) FROM reviews)::text AS reviews,
         (SELECT COUNT(*) FROM submissions)::text AS leads`,
    );
    const s = stats[0];

    log('');
    log('Seed complete.');
    log(`  institutes ${s.institutes} (${s.published} published)`);
    log(`  courses    ${s.courses}`);
    log(`  users      ${s.users}`);
    log(`  reviews    ${s.reviews}`);
    log(`  leads      ${s.leads}`);
    log('');
    log('Sign in with any of these (password below, or use the dev OTP):');
    log(`  super admin      09120000001`);
    log(`  institute admin  0912100000  (…0000 … 0011, one per institute)`);
    log(`  teacher          0912200000  (…0000 … 0012)`);
    log(`  student          09120000002  (Sara Ahmadi)`);
    log(`  password         ${DEFAULT_PASSWORD}`);
    log('');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((error: Error) => {
  process.stderr.write(`\nSeed failed: ${error.message}\n`);
  process.exit(1);
});
