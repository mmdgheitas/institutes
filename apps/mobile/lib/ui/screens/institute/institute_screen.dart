import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/enums.dart';
import '../../../data/models/institute.dart';
import '../../../data/repositories/discovery_repository.dart';
import '../../widgets/common.dart';
import '../../widgets/institute_card.dart';
import '../../widgets/map_markers.dart';

/// Institute storefront: gallery, courses, instructors, reviews and the
/// entry point into pre-registration.
class InstituteScreen extends StatefulWidget {
  const InstituteScreen({
    super.key,
    required this.slug,
    required this.repository,
  });

  final String slug;
  final DiscoveryRepository repository;

  @override
  State<InstituteScreen> createState() => _InstituteScreenState();
}

class _InstituteScreenState extends State<InstituteScreen> {
  InstituteStorefront? _storefront;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final InstituteStorefront data =
          await widget.repository.storefront(widget.slug);
      if (!mounted) return;
      setState(() {
        _storefront = data;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: LoadingView(message: 'Loading institute…'));
    }

    final InstituteStorefront? institute = _storefront;
    if (institute == null) {
      return Scaffold(
        appBar: AppBar(),
        body: ErrorView(
          message: _error ?? 'Institute not found',
          onRetry: _load,
        ),
      );
    }

    return Scaffold(
      body: CustomScrollView(
        slivers: <Widget>[
          _buildAppBar(institute),
          SliverToBoxAdapter(child: _buildHeader(institute)),
          if (institute.photos.isNotEmpty)
            SliverToBoxAdapter(child: _buildGallery(institute)),
          if (institute.videoTestimonials.isNotEmpty)
            SliverToBoxAdapter(child: _buildTestimonials(institute)),
          SliverToBoxAdapter(child: _buildCourses(institute)),
          if (institute.instructors.isNotEmpty)
            SliverToBoxAdapter(child: _buildInstructors(institute)),
          SliverToBoxAdapter(child: _buildLocation(institute)),
          if (institute.reviews.isNotEmpty)
            SliverToBoxAdapter(child: _buildReviews(institute)),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
      bottomNavigationBar: _buildCta(institute),
    );
  }

  Widget _buildAppBar(InstituteStorefront institute) {
    return SliverAppBar(
      expandedHeight: 220,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            AppNetworkImage(url: institute.coverImageUrl),
            // Scrim so the title stays legible over any photo.
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: <Color>[
                    Colors.black.withValues(alpha: 0.45),
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.25),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(InstituteStorefront institute) {
    final ThemeData theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (institute.logoUrl != null)
                Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: AppNetworkImage(
                    url: institute.logoUrl,
                    width: 56,
                    height: 56,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            institute.name,
                            style: theme.textTheme.headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        if (institute.isVerified)
                          const Padding(
                            padding: EdgeInsets.only(left: 6),
                            child: VerifiedBadge(size: 22),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: <Widget>[
                        RatingStars(
                          rating: institute.rating,
                          reviewCount: institute.reviewCount,
                          size: 18,
                        ),
                        const SizedBox(width: 12),
                        Flexible(
                          child: Text(
                            institute.city,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              if (institute.hasOnlineCourses)
                const TagChip(
                  label: 'Online classes',
                  icon: Icons.videocam_outlined,
                  color: AppTheme.secondary,
                ),
              if (institute.freePreRegistration)
                const TagChip(
                  label: 'Free pre-registration',
                  color: AppTheme.success,
                ),
              ...institute.categories.map(
                (CategorySummary c) => TagChip(
                  label: c.name,
                  color: AppTheme.parseHexColor(c.color),
                  icon: iconForCategory(c.slug),
                ),
              ),
            ],
          ),
          if (institute.description != null) ...<Widget>[
            const SizedBox(height: 14),
            Text(institute.description!, style: theme.textTheme.bodyMedium),
          ],
          if (institute.amenities.isNotEmpty) ...<Widget>[
            const SizedBox(height: 14),
            Wrap(
              spacing: 14,
              runSpacing: 8,
              children: institute.amenities
                  .map(
                    (String amenity) => Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Icon(
                          Icons.check_circle_outline,
                          size: 15,
                          color: theme.colorScheme.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(amenity, style: theme.textTheme.bodySmall),
                      ],
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildGallery(InstituteStorefront institute) {
    return _Section(
      title: 'Gallery',
      subtitle: institute.photos.any(
        (MediaAsset m) => m.kind.name == 'panorama360',
      )
          ? 'Includes 360° views'
          : null,
      child: SizedBox(
        height: 150,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: institute.photos.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (BuildContext context, int index) {
            final MediaAsset asset = institute.photos[index];
            return GestureDetector(
              onTap: () => _openGallery(institute, index),
              child: Stack(
                children: <Widget>[
                  AppNetworkImage(
                    url: asset.previewUrl ?? asset.url,
                    width: 200,
                    height: 150,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  if (asset.kind.wire == 'PANORAMA_360')
                    const Positioned(
                      right: 8,
                      top: 8,
                      child: TagChip(label: '360°', dense: true),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  void _openGallery(InstituteStorefront institute, int initialIndex) {
    showDialog<void>(
      context: context,
      builder: (BuildContext context) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(
          children: <Widget>[
            PageView.builder(
              controller: PageController(initialPage: initialIndex),
              itemCount: institute.photos.length,
              itemBuilder: (BuildContext context, int index) =>
                  InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: Center(
                  child: AppNetworkImage(
                    url: institute.photos[index].url,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTestimonials(InstituteStorefront institute) {
    return _Section(
      title: 'Student stories',
      subtitle: 'Short video testimonials',
      child: SizedBox(
        height: 210,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: institute.videoTestimonials.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (BuildContext context, int index) {
            final ReviewItem review = institute.videoTestimonials[index];
            return GestureDetector(
              onTap: () => _openUrl(review.videoUrl!),
              child: Container(
                width: 130,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: Colors.black12,
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: <Widget>[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Container(color: Colors.black26),
                    ),
                    const Icon(
                      Icons.play_circle_fill_rounded,
                      size: 46,
                      color: Colors.white,
                    ),
                    Positioned(
                      left: 8,
                      right: 8,
                      bottom: 8,
                      child: Text(
                        review.authorName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildCourses(InstituteStorefront institute) {
    if (institute.courses.isEmpty) {
      return const _Section(
        title: 'Courses',
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('No published courses yet.'),
        ),
      );
    }

    return _Section(
      title: 'Courses',
      subtitle: '${institute.courses.length} available',
      child: Column(
        children: institute.courses
            .map((CourseSummary course) => _CourseTile(
                  course: course,
                  onEnrol: institute.canPreRegister
                      ? () => context.push(
                            '/institute/${institute.slug}/register'
                            '?formId=${institute.preRegistrationFormId}'
                            '&courseId=${course.id}',
                          )
                      : null,
                ))
            .toList(),
      ),
    );
  }

  Widget _buildInstructors(InstituteStorefront institute) {
    return _Section(
      title: 'Instructors',
      child: SizedBox(
        height: 168,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: institute.instructors.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (BuildContext context, int index) {
            final InstructorProfile instructor = institute.instructors[index];
            return SizedBox(
              width: 132,
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    children: <Widget>[
                      InitialsAvatar(
                        initials: instructor.fullName.isNotEmpty
                            ? instructor.fullName[0].toUpperCase()
                            : '?',
                        imageUrl: instructor.avatarUrl,
                        radius: 28,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        instructor.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      if (instructor.headline != null)
                        Text(
                          instructor.headline!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      const Spacer(),
                      RatingStars(
                        rating: instructor.rating,
                        reviewCount: instructor.reviewCount,
                        size: 13,
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildLocation(InstituteStorefront institute) {
    return _Section(
      title: 'Location',
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                height: 170,
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: institute.position,
                    initialZoom: 15,
                    // A static preview; tapping opens the real maps app.
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.none,
                    ),
                  ),
                  children: <Widget>[
                    TileLayer(
                      urlTemplate: AppConfig.tileUrlTemplate,
                      userAgentPackageName: AppConfig.tileUserAgent,
                    ),
                    MarkerLayer(
                      markers: <Marker>[
                        Marker(
                          point: institute.position,
                          width: 44,
                          height: 50,
                          alignment: Alignment.topCenter,
                          child: InstituteMarker(
                            pin: MapPin(
                              id: institute.id,
                              slug: institute.slug,
                              name: institute.name,
                              lat: institute.lat,
                              lng: institute.lng,
                              categorySlug: institute.categories.isNotEmpty
                                  ? institute.categories.first.slug
                                  : 'general',
                              categoryColor: institute.categories.isNotEmpty
                                  ? institute.categories.first.color
                                  : '#2563eb',
                              categoryIcon: 'graduation-cap',
                              rating: institute.rating,
                              reviewCount: institute.reviewCount,
                              verificationStatus: institute.verificationStatus,
                              hasOnlineCourses: institute.hasOnlineCourses,
                              hasActiveDiscount: false,
                              freePreRegistration:
                                  institute.freePreRegistration,
                            ),
                            isSelected: false,
                            onTap: () {},
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(institute.address),
            const SizedBox(height: 10),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _openDirections(institute.position),
                    icon: const Icon(Icons.directions_outlined),
                    label: const Text('Directions'),
                  ),
                ),
                if (institute.phone != null) ...<Widget>[
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _openUrl('tel:${institute.phone}'),
                      icon: const Icon(Icons.call_outlined),
                      label: const Text('Call'),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReviews(InstituteStorefront institute) {
    return _Section(
      title: 'Reviews',
      subtitle: '${institute.reviewCount} total',
      child: Column(
        children: institute.reviews.take(6).map((ReviewItem review) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        InitialsAvatar(
                          initials: review.authorName.isNotEmpty
                              ? review.authorName[0].toUpperCase()
                              : '?',
                          imageUrl: review.authorAvatarUrl,
                          radius: 16,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            review.authorName,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                        RatingStars(
                          rating: review.rating.toDouble(),
                          showNumber: false,
                        ),
                        Text(' ${review.rating}'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(review.body),
                    if (review.instituteReply != null) ...<Widget>[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              'Reply from the institute',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(review.instituteReply!),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget? _buildCta(InstituteStorefront institute) {
    if (!institute.canPreRegister) return null;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: FilledButton.icon(
          onPressed: () => context.push(
            '/institute/${institute.slug}/register'
            '?formId=${institute.preRegistrationFormId}',
          ),
          icon: const Icon(Icons.edit_note_rounded),
          label: Text(
            institute.freePreRegistration
                ? 'Pre-register for free'
                : 'Start pre-registration',
          ),
        ),
      ),
    );
  }

  Future<void> _openDirections(LatLng position) async {
    final Uri uri = Uri.parse(
      'https://www.openstreetmap.org/directions?to=${position.latitude},${position.longitude}',
    );
    await _openUri(uri);
  }

  Future<void> _openUrl(String url) async => _openUri(Uri.parse(url));

  Future<void> _openUri(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) showErrorSnack(context, 'Could not open ${uri.scheme} link');
    }
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.subtitle});

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              Text(
                title,
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              if (subtitle != null) ...<Widget>[
                const SizedBox(width: 8),
                Text(
                  subtitle!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
        child,
      ],
    );
  }
}

class _CourseTile extends StatelessWidget {
  const _CourseTile({required this.course, this.onEnrol});

  final CourseSummary course;
  final VoidCallback? onEnrol;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      course.title,
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  TagChip(
                    label: course.type.label,
                    dense: true,
                    color: course.type == CourseType.online
                        ? AppTheme.secondary
                        : theme.colorScheme.outline,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 6,
                children: <Widget>[
                  _meta(context, Icons.signal_cellular_alt, course.level.label),
                  if (course.durationHours > 0)
                    _meta(
                      context,
                      Icons.schedule_outlined,
                      '${course.durationHours} h',
                    ),
                  _meta(
                    context,
                    Icons.event_seat_outlined,
                    course.isFull
                        ? 'Full'
                        : '${course.seatsLeft} seats left',
                  ),
                ],
              ),
              if (course.sessions.isNotEmpty) ...<Widget>[
                const SizedBox(height: 8),
                Text(
                  course.sessions
                      .map((CourseSession s) => s.label)
                      .join(' • '),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: <Widget>[
                  if (course.hasDiscount) ...<Widget>[
                    Text(
                      formatPrice(course.price),
                      style: theme.textTheme.bodySmall?.copyWith(
                        decoration: TextDecoration.lineThrough,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Text(
                    formatPrice(course.effectivePrice),
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  if (course.hasDiscount) ...<Widget>[
                    const SizedBox(width: 6),
                    TagChip(
                      label: '-${course.discountPercent.round()}%',
                      color: AppTheme.danger,
                      dense: true,
                    ),
                  ],
                  const Spacer(),
                  if (onEnrol != null)
                    FilledButton.tonal(
                      onPressed: course.isFull ? null : onEnrol,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 38),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                      ),
                      child: Text(course.isFull ? 'Full' : 'Apply'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _meta(BuildContext context, IconData icon, String label) {
    final ThemeData theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: 14, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
