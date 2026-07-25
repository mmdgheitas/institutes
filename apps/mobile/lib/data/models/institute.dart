import 'package:equatable/equatable.dart';
import 'package:latlong2/latlong.dart';

import 'enums.dart';
import 'json_utils.dart';

/// A single map marker. Kept intentionally small — the map may hold hundreds.
class MapPin extends Equatable {
  const MapPin({
    required this.id,
    required this.slug,
    required this.name,
    required this.lat,
    required this.lng,
    required this.categorySlug,
    required this.categoryColor,
    required this.categoryIcon,
    required this.rating,
    required this.reviewCount,
    required this.verificationStatus,
    required this.hasOnlineCourses,
    required this.hasActiveDiscount,
    required this.freePreRegistration,
    this.minPrice,
    this.distanceMeters,
    this.coverImageUrl,
  });

  final String id;
  final String slug;
  final String name;
  final double lat;
  final double lng;
  final String categorySlug;
  final String categoryColor;
  final String categoryIcon;
  final double rating;
  final int reviewCount;
  final VerificationStatus verificationStatus;
  final bool hasOnlineCourses;
  final bool hasActiveDiscount;
  final bool freePreRegistration;
  final double? minPrice;
  final int? distanceMeters;
  final String? coverImageUrl;

  LatLng get position => LatLng(lat, lng);
  bool get isVerified => verificationStatus.isVerified;

  factory MapPin.fromJson(Map<String, dynamic> json) => MapPin(
        id: asString(json['id']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        lat: asDouble(json['lat']),
        lng: asDouble(json['lng']),
        categorySlug: asString(json['categorySlug'], fallback: 'general'),
        categoryColor: asString(json['categoryColor'], fallback: '#2563eb'),
        categoryIcon:
            asString(json['categoryIcon'], fallback: 'graduation-cap'),
        rating: asDouble(json['rating']),
        reviewCount: asInt(json['reviewCount']),
        verificationStatus:
            VerificationStatus.parse(asStringOrNull(json['verificationStatus'])),
        hasOnlineCourses: asBool(json['hasOnlineCourses']),
        hasActiveDiscount: asBool(json['hasActiveDiscount']),
        freePreRegistration: asBool(json['freePreRegistration']),
        minPrice: asDoubleOrNull(json['minPrice']),
        distanceMeters: asIntOrNull(json['distanceMeters']),
        coverImageUrl: asStringOrNull(json['coverImageUrl']),
      );

  @override
  List<Object?> get props => <Object?>[id, lat, lng, rating];
}

/// Map pin plus the extra fields the list/card view shows.
class InstituteCard extends Equatable {
  const InstituteCard({required this.pin, required this.city, required this.address, required this.courseCount, this.shortDescription});

  final MapPin pin;
  final String city;
  final String address;
  final int courseCount;
  final String? shortDescription;

  String get id => pin.id;
  String get name => pin.name;

  factory InstituteCard.fromJson(Map<String, dynamic> json) => InstituteCard(
        pin: MapPin.fromJson(json),
        city: asString(json['city']),
        address: asString(json['address']),
        courseCount: asInt(json['courseCount']),
        shortDescription: asStringOrNull(json['shortDescription']),
      );

  @override
  List<Object?> get props => <Object?>[pin.id];
}

class CategorySummary extends Equatable {
  const CategorySummary({
    required this.id,
    required this.slug,
    required this.name,
    required this.icon,
    required this.color,
    this.instituteCount,
  });

  final String id;
  final String slug;
  final String name;
  final String icon;
  final String color;
  final int? instituteCount;

  factory CategorySummary.fromJson(Map<String, dynamic> json) =>
      CategorySummary(
        id: asString(json['id']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        icon: asString(json['icon'], fallback: 'graduation-cap'),
        color: asString(json['color'], fallback: '#2563eb'),
        instituteCount: asIntOrNull(json['instituteCount']),
      );

  @override
  List<Object?> get props => <Object?>[id, slug];
}

class MediaAsset extends Equatable {
  const MediaAsset({
    required this.id,
    required this.kind,
    required this.position,
    this.url,
    this.thumbnailUrl,
    this.hlsUrl,
    this.durationSeconds,
    this.title,
  });

  final String id;
  final MediaKind kind;
  final int position;
  final String? url;
  final String? thumbnailUrl;
  final String? hlsUrl;
  final int? durationSeconds;
  final String? title;

  /// Best available still image for a grid tile.
  String? get previewUrl => thumbnailUrl ?? (kind == MediaKind.image ? url : null);

  factory MediaAsset.fromJson(Map<String, dynamic> json) => MediaAsset(
        id: asString(json['id']),
        kind: MediaKind.parse(asStringOrNull(json['kind'])),
        position: asInt(json['position']),
        url: asStringOrNull(json['url']),
        thumbnailUrl: asStringOrNull(json['thumbnailUrl']),
        hlsUrl: asStringOrNull(json['hlsUrl']),
        durationSeconds: asIntOrNull(json['durationSeconds']),
        title: asStringOrNull(json['title']),
      );

  @override
  List<Object?> get props => <Object?>[id];
}

class InstructorProfile extends Equatable {
  const InstructorProfile({
    required this.id,
    required this.fullName,
    required this.specialties,
    required this.rating,
    required this.reviewCount,
    this.avatarUrl,
    this.headline,
    this.bio,
    this.yearsOfExperience,
  });

  final String id;
  final String fullName;
  final List<String> specialties;
  final double rating;
  final int reviewCount;
  final String? avatarUrl;
  final String? headline;
  final String? bio;
  final int? yearsOfExperience;

  factory InstructorProfile.fromJson(Map<String, dynamic> json) =>
      InstructorProfile(
        id: asString(json['id']),
        fullName: asString(json['fullName']),
        specialties: asStringList(json['specialties']),
        rating: asDouble(json['rating']),
        reviewCount: asInt(json['reviewCount']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
        headline: asStringOrNull(json['headline']),
        bio: asStringOrNull(json['bio']),
        yearsOfExperience: asIntOrNull(json['yearsOfExperience']),
      );

  @override
  List<Object?> get props => <Object?>[id];
}

class CourseSession extends Equatable {
  const CourseSession({
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.room,
  });

  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final String? room;

  static const List<String> _dayNames = <String>[
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  String get dayName =>
      dayOfWeek >= 0 && dayOfWeek < 7 ? _dayNames[dayOfWeek] : 'Unknown';

  String get label => '$dayName $startTime–$endTime';

  factory CourseSession.fromJson(Map<String, dynamic> json) => CourseSession(
        dayOfWeek: asInt(json['dayOfWeek']),
        startTime: asString(json['startTime']),
        endTime: asString(json['endTime']),
        room: asStringOrNull(json['room']),
      );

  @override
  List<Object?> get props => <Object?>[dayOfWeek, startTime, endTime];
}

class CourseSummary extends Equatable {
  const CourseSummary({
    required this.id,
    required this.slug,
    required this.title,
    required this.type,
    required this.level,
    required this.price,
    required this.discountPercent,
    required this.effectivePrice,
    required this.currency,
    required this.durationHours,
    required this.capacity,
    required this.enrolledCount,
    required this.seatsLeft,
    required this.sessions,
    required this.instructorIds,
    this.startDate,
    this.description,
  });

  final String id;
  final String slug;
  final String title;
  final CourseType type;
  final CourseLevel level;
  final double price;
  final double discountPercent;
  final double effectivePrice;
  final String currency;
  final int durationHours;
  final int capacity;
  final int enrolledCount;
  final int seatsLeft;
  final List<CourseSession> sessions;
  final List<String> instructorIds;
  final DateTime? startDate;
  final String? description;

  bool get hasDiscount => discountPercent > 0;
  bool get isFull => seatsLeft <= 0;

  factory CourseSummary.fromJson(Map<String, dynamic> json) => CourseSummary(
        id: asString(json['id']),
        slug: asString(json['slug']),
        title: asString(json['title']),
        type: CourseType.parse(asStringOrNull(json['type'])),
        level: CourseLevel.parse(asStringOrNull(json['level'])),
        price: asDouble(json['price']),
        discountPercent: asDouble(json['discountPercent']),
        effectivePrice: asDouble(json['effectivePrice']),
        currency: asString(json['currency'], fallback: 'IRR'),
        durationHours: asInt(json['durationHours']),
        capacity: asInt(json['capacity']),
        enrolledCount: asInt(json['enrolledCount']),
        seatsLeft: asInt(json['seatsLeft']),
        sessions: asModelList(json['sessions'], CourseSession.fromJson),
        instructorIds: asStringList(json['instructorIds']),
        startDate: asDateOrNull(json['startDate']),
        description: asStringOrNull(json['description']),
      );

  @override
  List<Object?> get props => <Object?>[id];
}

class ReviewItem extends Equatable {
  const ReviewItem({
    required this.id,
    required this.rating,
    required this.body,
    required this.authorName,
    required this.createdAt,
    this.title,
    this.authorAvatarUrl,
    this.instituteReply,
    this.videoUrl,
  });

  final String id;
  final int rating;
  final String body;
  final String authorName;
  final DateTime createdAt;
  final String? title;
  final String? authorAvatarUrl;
  final String? instituteReply;
  final String? videoUrl;

  bool get hasVideo => (videoUrl ?? '').isNotEmpty;

  factory ReviewItem.fromJson(Map<String, dynamic> json) => ReviewItem(
        id: asString(json['id']),
        rating: asInt(json['rating']),
        body: asString(json['body']),
        authorName: asString(json['authorName'], fallback: 'Student'),
        createdAt: asDate(json['createdAt']),
        title: asStringOrNull(json['title']),
        authorAvatarUrl: asStringOrNull(json['authorAvatarUrl']),
        instituteReply: asStringOrNull(json['instituteReply']),
        videoUrl: asStringOrNull(json['videoUrl']),
      );

  @override
  List<Object?> get props => <Object?>[id];
}

/// Full storefront payload for the institute detail screen.
class InstituteStorefront extends Equatable {
  const InstituteStorefront({
    required this.id,
    required this.slug,
    required this.name,
    required this.address,
    required this.city,
    required this.lat,
    required this.lng,
    required this.rating,
    required this.reviewCount,
    required this.verificationStatus,
    required this.categories,
    required this.skills,
    required this.amenities,
    required this.gallery,
    required this.instructors,
    required this.courses,
    required this.reviews,
    required this.hasOnlineCourses,
    required this.freePreRegistration,
    this.description,
    this.shortDescription,
    this.logoUrl,
    this.coverImageUrl,
    this.phone,
    this.website,
    this.province,
    this.preRegistrationFormId,
    this.workingHours,
  });

  final String id;
  final String slug;
  final String name;
  final String address;
  final String city;
  final double lat;
  final double lng;
  final double rating;
  final int reviewCount;
  final VerificationStatus verificationStatus;
  final List<CategorySummary> categories;
  final List<String> skills;
  final List<String> amenities;
  final List<MediaAsset> gallery;
  final List<InstructorProfile> instructors;
  final List<CourseSummary> courses;
  final List<ReviewItem> reviews;
  final bool hasOnlineCourses;
  final bool freePreRegistration;
  final String? description;
  final String? shortDescription;
  final String? logoUrl;
  final String? coverImageUrl;
  final String? phone;
  final String? website;
  final String? province;
  final String? preRegistrationFormId;
  final Map<String, String>? workingHours;

  LatLng get position => LatLng(lat, lng);
  bool get isVerified => verificationStatus.isVerified;
  bool get canPreRegister => (preRegistrationFormId ?? '').isNotEmpty;

  /// Photos and 360° panoramas, excluding video testimonials.
  List<MediaAsset> get photos => gallery
      .where((MediaAsset m) =>
          m.kind == MediaKind.image || m.kind == MediaKind.panorama360)
      .toList(growable: false);

  List<MediaAsset> get videos =>
      gallery.where((MediaAsset m) => m.kind == MediaKind.video).toList(growable: false);

  List<ReviewItem> get videoTestimonials =>
      reviews.where((ReviewItem r) => r.hasVideo).toList(growable: false);

  factory InstituteStorefront.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> rawHours = asMap(json['workingHours']);
    return InstituteStorefront(
      id: asString(json['id']),
      slug: asString(json['slug']),
      name: asString(json['name']),
      address: asString(json['address']),
      city: asString(json['city']),
      lat: asDouble(json['lat']),
      lng: asDouble(json['lng']),
      rating: asDouble(json['rating']),
      reviewCount: asInt(json['reviewCount']),
      verificationStatus:
          VerificationStatus.parse(asStringOrNull(json['verificationStatus'])),
      categories: asModelList(json['categories'], CategorySummary.fromJson),
      skills: asStringList(json['skills']),
      amenities: asStringList(json['amenities']),
      gallery: asModelList(json['gallery'], MediaAsset.fromJson),
      instructors: asModelList(json['instructors'], InstructorProfile.fromJson),
      courses: asModelList(json['courses'], CourseSummary.fromJson),
      reviews: asModelList(json['reviews'], ReviewItem.fromJson),
      hasOnlineCourses: asBool(json['hasOnlineCourses']),
      freePreRegistration: asBool(json['freePreRegistration']),
      description: asStringOrNull(json['description']),
      shortDescription: asStringOrNull(json['shortDescription']),
      logoUrl: asStringOrNull(json['logoUrl']),
      coverImageUrl: asStringOrNull(json['coverImageUrl']),
      phone: asStringOrNull(json['phone']),
      website: asStringOrNull(json['website']),
      province: asStringOrNull(json['province']),
      preRegistrationFormId: asStringOrNull(json['preRegistrationFormId']),
      workingHours: rawHours.isEmpty
          ? null
          : rawHours.map(
              (String k, dynamic v) => MapEntry<String, String>(k, asString(v)),
            ),
    );
  }

  @override
  List<Object?> get props => <Object?>[id, rating, reviewCount];
}
