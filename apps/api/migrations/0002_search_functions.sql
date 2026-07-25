-- =============================================================================
-- 0002_search_functions.sql
-- Materialized discovery helpers: a denormalized institute search view kept in
-- sync by triggers, plus a SQL function for radius search that lets PostGIS use
-- the GIST index (ST_DWithin on geography is index-accelerated).
-- =============================================================================

-- Denormalized flags that the map query needs but that live on child tables.
ALTER TABLE institutes
  ADD COLUMN IF NOT EXISTS has_online_courses boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_active_discount boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS course_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS institutes_flags_idx
  ON institutes (has_online_courses, has_active_discount, free_pre_registration);
CREATE INDEX IF NOT EXISTS institutes_min_price_idx ON institutes (min_price);

-- Recompute the denormalized course aggregates for one institute.
CREATE OR REPLACE FUNCTION refresh_institute_course_flags(target uuid)
RETURNS void AS $$
BEGIN
  UPDATE institutes i
     SET has_online_courses  = COALESCE(agg.has_online, false),
         has_active_discount = COALESCE(agg.has_discount, false),
         min_price           = agg.min_price,
         course_count        = COALESCE(agg.cnt, 0)
    FROM (
      SELECT
        bool_or(type IN ('ONLINE','HYBRID'))       AS has_online,
        bool_or(discount_percent > 0)              AS has_discount,
        MIN(price * (1 - discount_percent / 100))  AS min_price,
        COUNT(*)                                   AS cnt
      FROM courses
      WHERE institute_id = target AND is_published
    ) agg
   WHERE i.id = target;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION courses_sync_institute_flags() RETURNS trigger AS $$
BEGIN
  PERFORM refresh_institute_course_flags(COALESCE(NEW.institute_id, OLD.institute_id));
  IF TG_OP = 'UPDATE' AND NEW.institute_id IS DISTINCT FROM OLD.institute_id THEN
    PERFORM refresh_institute_course_flags(OLD.institute_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS courses_sync_flags ON courses;
CREATE TRIGGER courses_sync_flags
  AFTER INSERT OR UPDATE OR DELETE ON courses
  FOR EACH ROW EXECUTE FUNCTION courses_sync_institute_flags();

-- -----------------------------------------------------------------------------
-- search_institutes(): single entry point used by the discovery endpoint.
-- Passing NULL for a filter disables it. Distance is NULL when no origin given.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_institutes(
  p_lat               double precision DEFAULT NULL,
  p_lng               double precision DEFAULT NULL,
  p_radius_meters     double precision DEFAULT NULL,
  p_min_lat           double precision DEFAULT NULL,
  p_min_lng           double precision DEFAULT NULL,
  p_max_lat           double precision DEFAULT NULL,
  p_max_lng           double precision DEFAULT NULL,
  p_category_slugs    text[]  DEFAULT NULL,
  p_skills            text[]  DEFAULT NULL,
  p_min_rating        double precision DEFAULT NULL,
  p_has_online        boolean DEFAULT NULL,
  p_has_discount      boolean DEFAULT NULL,
  p_free_prereg       boolean DEFAULT NULL,
  p_verified_only     boolean DEFAULT NULL,
  p_max_price         numeric DEFAULT NULL,
  p_query             text    DEFAULT NULL,
  p_sort              text    DEFAULT 'distance',
  p_limit             integer DEFAULT 50,
  p_offset            integer DEFAULT 0
)
RETURNS TABLE (
  id                  uuid,
  slug                varchar,
  name                varchar,
  short_description   varchar,
  address             varchar,
  city                varchar,
  latitude            double precision,
  longitude           double precision,
  rating              double precision,
  review_count        integer,
  verification_status verification_status,
  has_online_courses  boolean,
  has_active_discount boolean,
  free_pre_registration boolean,
  min_price           numeric,
  course_count        integer,
  cover_image_url     varchar,
  category_slug       varchar,
  category_color      varchar,
  category_icon       varchar,
  distance_meters     double precision,
  total_count         bigint
) AS $$
DECLARE
  origin geography := CASE
    WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ELSE NULL
  END;
  bbox geography := CASE
    WHEN p_min_lat IS NOT NULL AND p_min_lng IS NOT NULL
     AND p_max_lat IS NOT NULL AND p_max_lng IS NOT NULL
    THEN ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
    ELSE NULL
  END;
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT
      i.*,
      c.slug  AS cat_slug,
      c.color AS cat_color,
      c.icon  AS cat_icon,
      CASE WHEN origin IS NULL THEN NULL
           ELSE ST_Distance(i.location, origin) END AS dist
    FROM institutes i
    LEFT JOIN LATERAL (
      SELECT cat.slug, cat.color, cat.icon
        FROM institute_categories ic
        JOIN categories cat ON cat.id = ic.category_id
       WHERE ic.institute_id = i.id
       ORDER BY ic.is_primary DESC, cat.position ASC
       LIMIT 1
    ) c ON true
    WHERE i.is_active
      AND i.is_published
      -- Index-accelerated radius filter.
      AND (origin IS NULL OR p_radius_meters IS NULL
           OR ST_DWithin(i.location, origin, p_radius_meters))
      AND (bbox IS NULL OR ST_Intersects(i.location, bbox))
      AND (p_min_rating IS NULL OR i.rating >= p_min_rating)
      AND (p_has_online IS NULL OR i.has_online_courses = p_has_online)
      AND (p_has_discount IS NULL OR i.has_active_discount = p_has_discount)
      AND (p_free_prereg IS NULL OR i.free_pre_registration = p_free_prereg)
      AND (p_verified_only IS NOT TRUE OR i.verification_status = 'VERIFIED')
      AND (p_max_price IS NULL OR (i.min_price IS NOT NULL AND i.min_price <= p_max_price))
      AND (p_skills IS NULL OR i.skills && p_skills)
      AND (p_query IS NULL OR p_query = '' OR
           i.name ILIKE '%' || p_query || '%' OR
           i.short_description ILIKE '%' || p_query || '%' OR
           EXISTS (SELECT 1 FROM unnest(i.skills) s WHERE s ILIKE '%' || p_query || '%'))
      AND (p_category_slugs IS NULL OR EXISTS (
            SELECT 1 FROM institute_categories ic2
              JOIN categories cat2 ON cat2.id = ic2.category_id
             WHERE ic2.institute_id = i.id AND cat2.slug = ANY(p_category_slugs)))
  ), counted AS (
    SELECT f.*, COUNT(*) OVER () AS total FROM filtered f
  )
  SELECT
    counted.id,
    counted.slug,
    counted.name,
    counted.short_description,
    counted.address,
    counted.city,
    counted.latitude,
    counted.longitude,
    counted.rating,
    counted.review_count,
    counted.verification_status,
    counted.has_online_courses,
    counted.has_active_discount,
    counted.free_pre_registration,
    counted.min_price,
    counted.course_count,
    counted.cover_image_url,
    counted.cat_slug,
    counted.cat_color,
    counted.cat_icon,
    counted.dist,
    counted.total
  FROM counted
  ORDER BY
    CASE WHEN p_sort = 'distance'   THEN counted.dist END ASC NULLS LAST,
    CASE WHEN p_sort = 'rating'     THEN counted.rating END DESC NULLS LAST,
    CASE WHEN p_sort = 'price'      THEN counted.min_price END ASC NULLS LAST,
    CASE WHEN p_sort = 'popularity' THEN counted.review_count END DESC NULLS LAST,
    counted.rating DESC, counted.id ASC
  LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Keep enrolled_count honest without application-level races.
CREATE OR REPLACE FUNCTION enrollments_sync_course_count() RETURNS trigger AS $$
DECLARE
  target uuid := COALESCE(NEW.course_id, OLD.course_id);
BEGIN
  UPDATE courses c
     SET enrolled_count = (
       SELECT COUNT(*) FROM enrollments e
        WHERE e.course_id = target AND e.status IN ('ACTIVE','COMPLETED')
     )
   WHERE c.id = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollments_sync_count ON enrollments;
CREATE TRIGGER enrollments_sync_count
  AFTER INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION enrollments_sync_course_count();
