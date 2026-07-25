import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';
import '../models/institute.dart';
import '../models/json_utils.dart';
import '../models/enums.dart';

/// Filters shared by the map and list views.
class DiscoveryFilters {
  const DiscoveryFilters({
    this.lat,
    this.lng,
    this.radiusMeters,
    this.bbox,
    this.categories = const <String>[],
    this.skills = const <String>[],
    this.minRating,
    this.hasOnline,
    this.hasDiscount,
    this.freePreRegistration,
    this.verifiedOnly,
    this.maxPrice,
    this.query,
    this.sort = DiscoverySort.distance,
  });

  final double? lat;
  final double? lng;
  final int? radiusMeters;

  /// [minLng, minLat, maxLng, maxLat]
  final List<double>? bbox;
  final List<String> categories;
  final List<String> skills;
  final double? minRating;
  final bool? hasOnline;
  final bool? hasDiscount;
  final bool? freePreRegistration;
  final bool? verifiedOnly;
  final double? maxPrice;
  final String? query;
  final DiscoverySort sort;

  /// Number of active filters, for the "Filters (3)" badge.
  int get activeCount {
    int count = 0;
    if (categories.isNotEmpty) count++;
    if (skills.isNotEmpty) count++;
    if (minRating != null) count++;
    if (hasOnline == true) count++;
    if (hasDiscount == true) count++;
    if (freePreRegistration == true) count++;
    if (verifiedOnly == true) count++;
    if (maxPrice != null) count++;
    return count;
  }

  DiscoveryFilters copyWith({
    double? lat,
    double? lng,
    int? radiusMeters,
    List<double>? bbox,
    List<String>? categories,
    List<String>? skills,
    double? minRating,
    bool? hasOnline,
    bool? hasDiscount,
    bool? freePreRegistration,
    bool? verifiedOnly,
    double? maxPrice,
    String? query,
    DiscoverySort? sort,
    bool clearMinRating = false,
    bool clearMaxPrice = false,
    bool clearQuery = false,
  }) {
    return DiscoveryFilters(
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      radiusMeters: radiusMeters ?? this.radiusMeters,
      bbox: bbox ?? this.bbox,
      categories: categories ?? this.categories,
      skills: skills ?? this.skills,
      minRating: clearMinRating ? null : (minRating ?? this.minRating),
      hasOnline: hasOnline ?? this.hasOnline,
      hasDiscount: hasDiscount ?? this.hasDiscount,
      freePreRegistration: freePreRegistration ?? this.freePreRegistration,
      verifiedOnly: verifiedOnly ?? this.verifiedOnly,
      maxPrice: clearMaxPrice ? null : (maxPrice ?? this.maxPrice),
      query: clearQuery ? null : (query ?? this.query),
      sort: sort ?? this.sort,
    );
  }

  /// Only non-null values are sent, so the server applies its own defaults.
  Map<String, dynamic> toQuery() => <String, dynamic>{
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
        if (radiusMeters != null) 'radiusMeters': radiusMeters,
        if (bbox != null && bbox!.length == 4) 'bbox': bbox!.join(','),
        if (categories.isNotEmpty) 'categories': categories.join(','),
        if (skills.isNotEmpty) 'skills': skills.join(','),
        if (minRating != null) 'minRating': minRating,
        if (hasOnline != null) 'hasOnline': hasOnline,
        if (hasDiscount != null) 'hasDiscount': hasDiscount,
        if (freePreRegistration != null)
          'freePreRegistration': freePreRegistration,
        if (verifiedOnly != null) 'verifiedOnly': verifiedOnly,
        if (maxPrice != null) 'maxPrice': maxPrice,
        if (query != null && query!.isNotEmpty) 'query': query,
        'sort': sort.wire,
      };
}

class DiscoveryRepository {
  DiscoveryRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  /// Pins for the current viewport. [cancelToken] lets rapid map panning
  /// abort in-flight requests instead of racing them.
  Future<List<MapPin>> mapPins(
    DiscoveryFilters filters, {
    int limit = 500,
    CancelToken? cancelToken,
  }) async {
    final dynamic data = await _api.get<dynamic>(
      '/map/pins',
      query: <String, dynamic>{...filters.toQuery(), 'limit': limit},
      cancelToken: cancelToken,
    );
    return asModelList(asMap(data)['pins'], MapPin.fromJson);
  }

  /// Paginated cards for the list view.
  Future<({List<InstituteCard> items, int total, int totalPages})> listInstitutes(
    DiscoveryFilters filters, {
    int page = 1,
    int pageSize = 20,
    CancelToken? cancelToken,
  }) async {
    final dynamic data = await _api.get<dynamic>(
      '/institutes',
      query: <String, dynamic>{
        ...filters.toQuery(),
        'page': page,
        'pageSize': pageSize,
      },
      cancelToken: cancelToken,
    );
    final Map<String, dynamic> map = asMap(data);
    return (
      items: asModelList(map['items'], InstituteCard.fromJson),
      total: asInt(map['total']),
      totalPages: asInt(map['totalPages']),
    );
  }

  Future<List<CategorySummary>> categories() async {
    final dynamic data = await _api.get<dynamic>('/categories');
    return asModelList(data, CategorySummary.fromJson);
  }

  Future<List<String>> skills() async {
    final dynamic data = await _api.get<dynamic>('/skills');
    if (data is! List) return const <String>[];
    return data
        .whereType<Map<dynamic, dynamic>>()
        .map((Map<dynamic, dynamic> e) => asString(e['skill']))
        .where((String s) => s.isNotEmpty)
        .toList(growable: false);
  }

  Future<InstituteStorefront> storefront(String slugOrId) async {
    final dynamic data = await _api.get<dynamic>('/institutes/$slugOrId');
    return InstituteStorefront.fromJson(asMap(data));
  }

  Future<List<MapPin>> nearby(String instituteId) async {
    final dynamic data = await _api.get<dynamic>('/institutes/$instituteId/nearby');
    return asModelList(data, MapPin.fromJson);
  }
}
