part of 'discovery_bloc.dart';

enum DiscoveryStatus { initial, loading, success, failure }

/// Map view vs vertical card list.
enum ViewMode { map, list }

class DiscoveryState extends Equatable {
  const DiscoveryState({
    this.status = DiscoveryStatus.initial,
    this.viewMode = ViewMode.map,
    this.filters = const DiscoveryFilters(),
    this.pins = const <MapPin>[],
    this.clusters = const <MapCluster>[],
    this.cards = const <InstituteCard>[],
    this.categories = const <CategorySummary>[],
    this.availableSkills = const <String>[],
    this.total = 0,
    this.page = 1,
    this.totalPages = 1,
    this.isLoadingMore = false,
    this.zoom = AppConfig.defaultZoom,
    this.userLocation,
    this.selectedPinId,
    this.error,
    this.locationDenied = false,
  });

  final DiscoveryStatus status;
  final ViewMode viewMode;
  final DiscoveryFilters filters;

  /// Raw pins from the server for the current viewport.
  final List<MapPin> pins;

  /// [pins] grouped for the current [zoom].
  final List<MapCluster> clusters;

  final List<InstituteCard> cards;
  final List<CategorySummary> categories;
  final List<String> availableSkills;
  final int total;
  final int page;
  final int totalPages;
  final bool isLoadingMore;
  final double zoom;
  final LatLng? userLocation;
  final String? selectedPinId;
  final String? error;
  final bool locationDenied;

  bool get isLoading => status == DiscoveryStatus.loading;
  bool get hasMore => page < totalPages;
  bool get isEmpty => status == DiscoveryStatus.success && total == 0;

  MapPin? get selectedPin {
    final String? id = selectedPinId;
    if (id == null) return null;
    for (final MapPin pin in pins) {
      if (pin.id == id) return pin;
    }
    return null;
  }

  DiscoveryState copyWith({
    DiscoveryStatus? status,
    ViewMode? viewMode,
    DiscoveryFilters? filters,
    List<MapPin>? pins,
    List<MapCluster>? clusters,
    List<InstituteCard>? cards,
    List<CategorySummary>? categories,
    List<String>? availableSkills,
    int? total,
    int? page,
    int? totalPages,
    bool? isLoadingMore,
    double? zoom,
    LatLng? userLocation,
    String? selectedPinId,
    String? error,
    bool? locationDenied,
    bool clearError = false,
    bool clearSelection = false,
  }) {
    return DiscoveryState(
      status: status ?? this.status,
      viewMode: viewMode ?? this.viewMode,
      filters: filters ?? this.filters,
      pins: pins ?? this.pins,
      clusters: clusters ?? this.clusters,
      cards: cards ?? this.cards,
      categories: categories ?? this.categories,
      availableSkills: availableSkills ?? this.availableSkills,
      total: total ?? this.total,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      zoom: zoom ?? this.zoom,
      userLocation: userLocation ?? this.userLocation,
      selectedPinId:
          clearSelection ? null : (selectedPinId ?? this.selectedPinId),
      error: clearError ? null : (error ?? this.error),
      locationDenied: locationDenied ?? this.locationDenied,
    );
  }

  @override
  List<Object?> get props => <Object?>[
        status,
        viewMode,
        filters,
        pins,
        clusters,
        cards,
        total,
        page,
        isLoadingMore,
        zoom,
        userLocation,
        selectedPinId,
        error,
        locationDenied,
      ];
}
