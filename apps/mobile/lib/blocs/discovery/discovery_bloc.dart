import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:stream_transform/stream_transform.dart';

import '../../core/config/app_config.dart';
import '../../core/map/marker_cluster.dart';
import '../../core/network/api_exception.dart';
import '../../data/models/institute.dart';
import '../../data/repositories/discovery_repository.dart';

part 'discovery_event.dart';
part 'discovery_state.dart';

/// Debounce so panning the map does not fire a request per frame.
EventTransformer<E> _debounce<E>(Duration duration) {
  return (Stream<E> events, EventMapper<E> mapper) =>
      events.debounce(duration).switchMap(mapper);
}

class DiscoveryBloc extends Bloc<DiscoveryEvent, DiscoveryState> {
  DiscoveryBloc({
    required DiscoveryRepository repository,
    MarkerClusterer? clusterer,
  })  : _repository = repository,
        _clusterer = clusterer ?? const MarkerClusterer(),
        super(const DiscoveryState()) {
    on<DiscoveryStarted>(_onStarted);
    on<MapViewportChanged>(
      _onViewportChanged,
      transformer: _debounce<MapViewportChanged>(
        const Duration(milliseconds: 400),
      ),
    );
    on<SearchQueryChanged>(
      _onSearchChanged,
      transformer: _debounce<SearchQueryChanged>(
        const Duration(milliseconds: 350),
      ),
    );
    on<FiltersChanged>(_onFiltersChanged);
    on<FiltersCleared>(_onFiltersCleared);
    on<CategoryToggled>(_onCategoryToggled);
    on<ViewModeToggled>(_onViewModeToggled);
    on<PinSelected>(_onPinSelected);
    on<LocationRequested>(_onLocationRequested);
    on<NextPageRequested>(_onNextPage);
    on<DiscoveryRefreshed>(_onRefreshed);
  }

  final DiscoveryRepository _repository;
  final MarkerClusterer _clusterer;

  /// Cancels the previous in-flight search when a new one starts.
  CancelToken? _inFlight;

  @override
  Future<void> close() {
    _inFlight?.cancel('bloc closed');
    return super.close();
  }

  Future<void> _onStarted(
    DiscoveryStarted event,
    Emitter<DiscoveryState> emit,
  ) async {
    emit(state.copyWith(status: DiscoveryStatus.loading, clearError: true));

    // Reference data is non-critical: a failure must not block the map.
    try {
      final List<CategorySummary> categories = await _repository.categories();
      emit(state.copyWith(categories: categories));
    } on ApiException {
      // Ignored on purpose.
    }
    try {
      final List<String> skills = await _repository.skills();
      emit(state.copyWith(availableSkills: skills));
    } on ApiException {
      // Ignored on purpose.
    }

    // Try to centre on the user; fall back to the configured default.
    await _resolveLocation(emit, silent: true);
    await _search(emit);
  }

  Future<void> _onViewportChanged(
    MapViewportChanged event,
    Emitter<DiscoveryState> emit,
  ) async {
    emit(state.copyWith(
      zoom: event.zoom,
      filters: state.filters.copyWith(
        lat: event.center.latitude,
        lng: event.center.longitude,
        bbox: event.bounds,
      ),
    ));
    await _search(emit);
  }

  Future<void> _onSearchChanged(
    SearchQueryChanged event,
    Emitter<DiscoveryState> emit,
  ) async {
    final String trimmed = event.query.trim();
    emit(state.copyWith(
      filters: trimmed.isEmpty
          ? state.filters.copyWith(clearQuery: true)
          : state.filters.copyWith(query: trimmed),
      page: 1,
    ));
    await _search(emit);
  }

  Future<void> _onFiltersChanged(
    FiltersChanged event,
    Emitter<DiscoveryState> emit,
  ) async {
    emit(state.copyWith(filters: event.filters, page: 1));
    await _search(emit);
  }

  Future<void> _onFiltersCleared(
    FiltersCleared event,
    Emitter<DiscoveryState> emit,
  ) async {
    // Keep the geographic context, drop everything else.
    emit(state.copyWith(
      filters: DiscoveryFilters(
        lat: state.filters.lat,
        lng: state.filters.lng,
        bbox: state.filters.bbox,
        radiusMeters: state.filters.radiusMeters,
        sort: state.filters.sort,
      ),
      page: 1,
    ));
    await _search(emit);
  }

  Future<void> _onCategoryToggled(
    CategoryToggled event,
    Emitter<DiscoveryState> emit,
  ) async {
    final List<String> next = List<String>.from(state.filters.categories);
    if (next.contains(event.slug)) {
      next.remove(event.slug);
    } else {
      next.add(event.slug);
    }
    emit(state.copyWith(
      filters: state.filters.copyWith(categories: next),
      page: 1,
    ));
    await _search(emit);
  }

  Future<void> _onViewModeToggled(
    ViewModeToggled event,
    Emitter<DiscoveryState> emit,
  ) async {
    final ViewMode next =
        state.viewMode == ViewMode.map ? ViewMode.list : ViewMode.map;
    emit(state.copyWith(viewMode: next, clearSelection: true));
    // The list view needs card data, which the pin endpoint does not return.
    if (next == ViewMode.list && state.cards.isEmpty) {
      await _search(emit);
    }
  }

  void _onPinSelected(PinSelected event, Emitter<DiscoveryState> emit) {
    if (event.pinId == null) {
      emit(state.copyWith(clearSelection: true));
    } else {
      emit(state.copyWith(selectedPinId: event.pinId));
    }
  }

  Future<void> _onLocationRequested(
    LocationRequested event,
    Emitter<DiscoveryState> emit,
  ) async {
    await _resolveLocation(emit, silent: false);
    await _search(emit);
  }

  Future<void> _onNextPage(
    NextPageRequested event,
    Emitter<DiscoveryState> emit,
  ) async {
    if (state.isLoadingMore || !state.hasMore) return;

    emit(state.copyWith(isLoadingMore: true));
    try {
      final ({List<InstituteCard> items, int total, int totalPages}) result =
          await _repository.listInstitutes(
        state.filters,
        page: state.page + 1,
      );
      emit(state.copyWith(
        cards: <InstituteCard>[...state.cards, ...result.items],
        page: state.page + 1,
        total: result.total,
        totalPages: result.totalPages,
        isLoadingMore: false,
      ));
    } on ApiException catch (error) {
      emit(state.copyWith(isLoadingMore: false, error: error.message));
    }
  }

  Future<void> _onRefreshed(
    DiscoveryRefreshed event,
    Emitter<DiscoveryState> emit,
  ) async {
    emit(state.copyWith(page: 1));
    await _search(emit);
  }

  /// Single search path used by every event, so behaviour cannot diverge.
  Future<void> _search(Emitter<DiscoveryState> emit) async {
    _inFlight?.cancel('superseded');
    final CancelToken token = CancelToken();
    _inFlight = token;

    emit(state.copyWith(status: DiscoveryStatus.loading, clearError: true));

    try {
      if (state.viewMode == ViewMode.map) {
        final List<MapPin> pins =
            await _repository.mapPins(state.filters, cancelToken: token);
        if (token.isCancelled) return;

        emit(state.copyWith(
          status: DiscoveryStatus.success,
          pins: pins,
          clusters: _clusterer.cluster(pins, state.zoom),
          total: pins.length,
        ));
      } else {
        final ({List<InstituteCard> items, int total, int totalPages}) result =
            await _repository.listInstitutes(
          state.filters,
          page: 1,
          cancelToken: token,
        );
        if (token.isCancelled) return;

        emit(state.copyWith(
          status: DiscoveryStatus.success,
          cards: result.items,
          total: result.total,
          totalPages: result.totalPages,
          page: 1,
        ));
      }
    } on ApiException catch (error) {
      if (token.isCancelled) return;
      emit(state.copyWith(
        status: DiscoveryStatus.failure,
        error: error.message,
      ));
    }
  }

  /// Resolves GPS position, handling every permission outcome.
  Future<void> _resolveLocation(
    Emitter<DiscoveryState> emit, {
    required bool silent,
  }) async {
    try {
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (!silent) {
          emit(state.copyWith(
            locationDenied: true,
            error: 'Location services are turned off.',
          ));
        }
        _applyFallbackCentre(emit);
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (!silent) {
          emit(state.copyWith(
            locationDenied: true,
            error: 'Location permission denied. Showing the default area.',
          ));
        }
        _applyFallbackCentre(emit);
        return;
      }

      final Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      );

      final LatLng here = LatLng(position.latitude, position.longitude);
      emit(state.copyWith(
        userLocation: here,
        locationDenied: false,
        filters: state.filters.copyWith(
          lat: here.latitude,
          lng: here.longitude,
          radiusMeters:
              state.filters.radiusMeters ?? AppConfig.defaultRadiusMeters,
        ),
      ));
    } on Object {
      // Timeouts and platform errors both fall back to the default centre.
      _applyFallbackCentre(emit);
    }
  }

  void _applyFallbackCentre(Emitter<DiscoveryState> emit) {
    if (state.filters.lat != null && state.filters.lng != null) return;
    emit(state.copyWith(
      filters: state.filters.copyWith(
        lat: AppConfig.defaultLat,
        lng: AppConfig.defaultLng,
        radiusMeters: AppConfig.defaultRadiusMeters,
      ),
    ));
  }
}
