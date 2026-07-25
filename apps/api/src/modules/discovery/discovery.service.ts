import { Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'kysely';
import {
  VerificationStatus,
  type CategorySummary,
  type InstituteCard,
  type InstituteStorefront,
  type MapPin,
  type MediaAsset,
  type Paginated,
  type ReviewItem,
} from '@institutes/shared';
import { DatabaseService } from '../../db/database.service';
import { paginate } from '../../common/dto/pagination.dto';
import type { DiscoveryQueryDto, MapPinsQueryDto } from './dto/discovery.dto';

/** Row shape returned by the `search_institutes()` SQL function. */
interface SearchRow {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  rating: number;
  review_count: number;
  verification_status: string;
  has_online_courses: boolean;
  has_active_discount: boolean;
  free_pre_registration: boolean;
  min_price: string | null;
  course_count: number;
  cover_image_url: string | null;
  category_slug: string | null;
  category_color: string | null;
  category_icon: string | null;
  distance_meters: number | null;
  total_count: number;
}

@Injectable()
export class DiscoveryService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Runs the PostGIS-backed search. All filtering happens inside
   * `search_institutes()` so the GIST index on `institutes.location` is used
   * for radius/bbox predicates.
   */
  private async runSearch(
    query: DiscoveryQueryDto,
    limit: number,
    offset: number,
  ): Promise<SearchRow[]> {
    const bbox = query.bbox && query.bbox.length === 4 ? query.bbox : null;
    // Default to a 5 km radius whenever an origin is supplied without one.
    const radius =
      query.lat != null && query.lng != null ? (query.radiusMeters ?? 5000) : null;

    const result = await sql<SearchRow>`
      SELECT * FROM search_institutes(
        ${query.lat ?? null}::double precision,
        ${query.lng ?? null}::double precision,
        ${radius}::double precision,
        ${bbox ? bbox[1] : null}::double precision,
        ${bbox ? bbox[0] : null}::double precision,
        ${bbox ? bbox[3] : null}::double precision,
        ${bbox ? bbox[2] : null}::double precision,
        ${query.categories?.length ? query.categories : null}::text[],
        ${query.skills?.length ? query.skills : null}::text[],
        ${query.minRating ?? null}::double precision,
        ${query.hasOnline ?? null}::boolean,
        ${query.hasDiscount ?? null}::boolean,
        ${query.freePreRegistration ?? null}::boolean,
        ${query.verifiedOnly ?? null}::boolean,
        ${query.maxPrice ?? null}::numeric,
        ${query.query ?? null}::text,
        ${query.sort}::text,
        ${limit}::integer,
        ${offset}::integer
      )
    `.execute(this.database.db);

    return result.rows;
  }

  private toMapPin(row: SearchRow): MapPin {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      lat: row.latitude,
      lng: row.longitude,
      categorySlug: row.category_slug ?? 'general',
      categoryColor: row.category_color ?? '#2563eb',
      categoryIcon: row.category_icon ?? 'graduation-cap',
      rating: Number(row.rating.toFixed(2)),
      reviewCount: row.review_count,
      verificationStatus: row.verification_status as MapPin['verificationStatus'],
      hasOnlineCourses: row.has_online_courses,
      hasActiveDiscount: row.has_active_discount,
      freePreRegistration: row.free_pre_registration,
      minPrice: row.min_price != null ? Number(row.min_price) : null,
      distanceMeters:
        row.distance_meters != null ? Math.round(row.distance_meters) : null,
      coverImageUrl: row.cover_image_url,
    };
  }

  private toCard(row: SearchRow): InstituteCard {
    return {
      ...this.toMapPin(row),
      shortDescription: row.short_description,
      city: row.city,
      address: row.address,
      courseCount: row.course_count,
    };
  }

  /** Lightweight payload for map rendering (clustered client-side). */
  async mapPins(query: MapPinsQueryDto): Promise<{ pins: MapPin[]; total: number }> {
    const rows = await this.runSearch(query, query.limit, 0);
    return {
      pins: rows.map((row) => this.toMapPin(row)),
      total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    };
  }

  /** Paginated card list for the "list view" toggle. */
  async listInstitutes(query: DiscoveryQueryDto): Promise<Paginated<InstituteCard>> {
    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.runSearch(query, query.pageSize, offset);
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    return paginate(
      rows.map((row) => this.toCard(row)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async listCategories(): Promise<CategorySummary[]> {
    const rows = await this.database.db
      .selectFrom('categories as c')
      .leftJoin('institute_categories as ic', 'ic.category_id', 'c.id')
      .leftJoin('institutes as i', (join) =>
        join
          .onRef('i.id', '=', 'ic.institute_id')
          .on('i.is_published', '=', true)
          .on('i.is_active', '=', true),
      )
      .select([
        'c.id',
        'c.slug',
        'c.name',
        'c.icon',
        'c.color',
        'c.position',
        (eb) => eb.fn.count<number>('i.id').distinct().as('institute_count'),
      ])
      .groupBy(['c.id', 'c.slug', 'c.name', 'c.icon', 'c.color', 'c.position'])
      .orderBy('c.position')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      icon: row.icon,
      color: row.color,
      instituteCount: Number(row.institute_count),
    }));
  }

  /** Distinct skills across published institutes, for the filter chips. */
  async listSkills(limit = 60): Promise<{ skill: string; count: number }[]> {
    const result = await sql<{ skill: string; count: number }>`
      SELECT skill, COUNT(*)::int AS count
        FROM institutes i, unnest(i.skills) AS skill
       WHERE i.is_published AND i.is_active
       GROUP BY skill
       ORDER BY count DESC, skill ASC
       LIMIT ${limit}
    `.execute(this.database.db);
    return result.rows;
  }

  /** Full storefront payload for the institute detail page. */
  async getStorefront(slugOrId: string): Promise<InstituteStorefront> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

    const institute = await this.database.db
      .selectFrom('institutes')
      .selectAll()
      .where((eb) => (isUuid ? eb('id', '=', slugOrId) : eb('slug', '=', slugOrId)))
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!institute || !institute.is_published) {
      throw new NotFoundException('Institute not found');
    }

    const [categories, gallery, instructors, courseRows, reviews, activeForm] =
      await Promise.all([
        this.database.db
          .selectFrom('institute_categories as ic')
          .innerJoin('categories as c', 'c.id', 'ic.category_id')
          .select(['c.id', 'c.slug', 'c.name', 'c.icon', 'c.color'])
          .where('ic.institute_id', '=', institute.id)
          .orderBy('ic.is_primary', 'desc')
          .execute(),

        this.database.db
          .selectFrom('media')
          .selectAll()
          .where('institute_id', '=', institute.id)
          .where('purpose', 'in', ['INSTITUTE_GALLERY', 'REVIEW_VIDEO'])
          .where('status', '=', 'READY')
          .orderBy('position')
          .execute(),

        this.database.db
          .selectFrom('instructors')
          .selectAll()
          .where('institute_id', '=', institute.id)
          .where('is_active', '=', true)
          .orderBy('rating', 'desc')
          .execute(),

        this.database.db
          .selectFrom('courses as co')
          .leftJoin('course_instructors as ci', 'ci.course_id', 'co.id')
          .select([
            'co.id',
            'co.slug',
            'co.title',
            'co.type',
            'co.level',
            'co.price',
            'co.discount_percent',
            'co.currency',
            'co.duration_hours',
            'co.capacity',
            'co.enrolled_count',
            'co.start_date',
            'co.schedule',
            sql<string[]>`COALESCE(array_agg(ci.instructor_id) FILTER (WHERE ci.instructor_id IS NOT NULL), '{}')`.as(
              'instructor_ids',
            ),
          ])
          .where('co.institute_id', '=', institute.id)
          .where('co.is_published', '=', true)
          .groupBy([
            'co.id',
            'co.slug',
            'co.title',
            'co.type',
            'co.level',
            'co.price',
            'co.discount_percent',
            'co.currency',
            'co.duration_hours',
            'co.capacity',
            'co.enrolled_count',
            'co.start_date',
            'co.schedule',
          ])
          .orderBy('co.start_date', 'asc')
          .execute(),

        this.database.db
          .selectFrom('reviews as r')
          .innerJoin('users as u', 'u.id', 'r.author_id')
          .leftJoin('media as m', 'm.id', 'r.video_media_id')
          .select([
            'r.id',
            'r.rating',
            'r.title',
            'r.body',
            'r.institute_reply',
            'r.created_at',
            'u.full_name',
            'u.avatar_url',
            'm.url as video_url',
          ])
          .where('r.institute_id', '=', institute.id)
          .where('r.is_published', '=', true)
          .orderBy('r.created_at', 'desc')
          .limit(20)
          .execute(),

        this.database.db
          .selectFrom('forms')
          .select('id')
          .where('institute_id', '=', institute.id)
          .where('is_active', '=', true)
          .orderBy('created_at', 'desc')
          .executeTakeFirst(),
      ]);

    const galleryAssets: MediaAsset[] = gallery.map((m) => ({
      id: m.id,
      kind: m.kind,
      status: m.status,
      url: m.url,
      thumbnailUrl: m.thumbnail_url,
      hlsUrl: m.hls_url,
      durationSeconds: m.duration_seconds,
      title: m.title,
      position: m.position,
    }));

    const reviewItems: ReviewItem[] = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      authorName: r.full_name,
      authorAvatarUrl: r.avatar_url,
      createdAt: r.created_at.toISOString(),
      instituteReply: r.institute_reply,
      videoUrl: r.video_url,
    }));

    return {
      id: institute.id,
      slug: institute.slug,
      name: institute.name,
      description: institute.description,
      shortDescription: institute.short_description,
      logoUrl: institute.logo_url,
      coverImageUrl: institute.cover_image_url,
      phone: institute.phone,
      website: institute.website,
      address: institute.address,
      city: institute.city,
      province: institute.province,
      lat: institute.latitude,
      lng: institute.longitude,
      rating: Number(institute.rating.toFixed(2)),
      reviewCount: institute.review_count,
      verificationStatus: institute.verification_status as VerificationStatus,
      categories: categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        color: c.color,
      })),
      skills: institute.skills,
      amenities: institute.amenities,
      gallery: galleryAssets,
      instructors: instructors.map((i) => ({
        id: i.id,
        fullName: i.full_name,
        avatarUrl: i.avatar_url,
        headline: i.headline,
        bio: i.bio,
        yearsOfExperience: i.years_of_experience,
        specialties: i.specialties,
        rating: Number(i.rating.toFixed(2)),
        reviewCount: i.review_count,
      })),
      courses: courseRows.map((c) => {
        const price = Number(c.price);
        const effective = price * (1 - c.discount_percent / 100);
        return {
          id: c.id,
          slug: c.slug,
          title: c.title,
          type: c.type,
          level: c.level,
          price,
          discountPercent: c.discount_percent,
          effectivePrice: Math.round(effective),
          currency: c.currency,
          durationHours: c.duration_hours,
          capacity: c.capacity,
          enrolledCount: c.enrolled_count,
          seatsLeft: Math.max(0, c.capacity - c.enrolled_count),
          startDate: c.start_date ? c.start_date.toISOString() : null,
          sessions: Array.isArray(c.schedule) ? c.schedule : [],
          instructorIds: c.instructor_ids ?? [],
        };
      }),
      reviews: reviewItems,
      hasOnlineCourses: institute.has_online_courses,
      freePreRegistration: institute.free_pre_registration,
      preRegistrationFormId: activeForm?.id ?? null,
      workingHours: institute.working_hours,
    };
  }

  /** Nearby institutes shown on a storefront ("others around here"). */
  async nearby(instituteId: string, limit = 6): Promise<MapPin[]> {
    const result = await sql<SearchRow>`
      WITH origin AS (
        SELECT location FROM institutes WHERE id = ${instituteId}::uuid
      )
      SELECT
        i.id, i.slug, i.name, i.short_description, i.address, i.city,
        i.latitude, i.longitude, i.rating, i.review_count, i.verification_status,
        i.has_online_courses, i.has_active_discount, i.free_pre_registration,
        i.min_price, i.course_count, i.cover_image_url,
        c.slug AS category_slug, c.color AS category_color, c.icon AS category_icon,
        ST_Distance(i.location, (SELECT location FROM origin)) AS distance_meters,
        0::bigint AS total_count
      FROM institutes i
      LEFT JOIN LATERAL (
        SELECT cat.slug, cat.color, cat.icon
          FROM institute_categories ic
          JOIN categories cat ON cat.id = ic.category_id
         WHERE ic.institute_id = i.id
         ORDER BY ic.is_primary DESC
         LIMIT 1
      ) c ON true
      WHERE i.id <> ${instituteId}::uuid
        AND i.is_published AND i.is_active
        AND ST_DWithin(i.location, (SELECT location FROM origin), 10000)
      ORDER BY distance_meters ASC
      LIMIT ${limit}
    `.execute(this.database.db);

    return result.rows.map((row) => this.toMapPin(row));
  }
}
