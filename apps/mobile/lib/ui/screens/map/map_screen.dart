import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../blocs/discovery/discovery_bloc.dart';
import '../../../core/config/app_config.dart';
import '../../../core/map/marker_cluster.dart';
import '../../../data/models/institute.dart';
import '../../widgets/common.dart';
import '../../widgets/institute_card.dart';
import '../../widgets/map_markers.dart';
import 'filter_sheet.dart';

/// Google-Maps-style full-screen discovery UI.
///
/// The map is the whole screen; search, filters and results float above it.
/// A toggle swaps the map for a vertical card list backed by the same filters.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();

  /// Set while we move the camera programmatically, so the resulting move
  /// events do not trigger another network fetch.
  bool _programmaticMove = false;

  @override
  void initState() {
    super.initState();
    context.read<DiscoveryBloc>().add(const DiscoveryStarted());
  }

  @override
  void dispose() {
    _searchController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  void _onMapEvent(MapEvent event) {
    // Only react once movement has settled. These three "end" events exist
    // across flutter_map 6/7/8, which keeps this resilient to minor upgrades.
    final bool settled = event is MapEventMoveEnd ||
        event is MapEventFlingAnimationEnd ||
        event is MapEventDoubleTapZoomEnd;
    if (!settled) return;

    if (_programmaticMove) {
      _programmaticMove = false;
      return;
    }
    // Use the camera carried by the event rather than reading the controller,
    // which may not have settled yet.
    _publishViewport(event.camera);
  }

  void _publishViewport([MapCamera? source]) {
    final MapCamera camera = source ?? _mapController.camera;
    final LatLngBounds bounds = camera.visibleBounds;
    context.read<DiscoveryBloc>().add(
          MapViewportChanged(
            center: camera.center,
            zoom: camera.zoom,
            bounds: <double>[
              bounds.west,
              bounds.south,
              bounds.east,
              bounds.north,
            ],
          ),
        );
  }

  void _moveCamera(LatLng target, double zoom) {
    _programmaticMove = true;
    _mapController.move(target, zoom);
  }

  /// Tapping a cluster zooms in far enough to break it apart.
  void _onClusterTapped(MapCluster cluster) {
    final double nextZoom =
        (_mapController.camera.zoom + 2).clamp(AppConfig.minZoom, AppConfig.maxZoom);
    _mapController.move(cluster.position, nextZoom);
    _publishViewport();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<DiscoveryBloc, DiscoveryState>(
        listenWhen: (DiscoveryState prev, DiscoveryState next) =>
            prev.error != next.error && next.error != null,
        listener: (BuildContext context, DiscoveryState state) {
          final String? error = state.error;
          if (error != null) showErrorSnack(context, error);
        },
        builder: (BuildContext context, DiscoveryState state) {
          return Stack(
            children: <Widget>[
              if (state.viewMode == ViewMode.map)
                _buildMap(state)
              else
                _buildList(state),

              _buildTopBar(state),

              if (state.viewMode == ViewMode.map) ...<Widget>[
                _buildMapControls(state),
                if (state.selectedPin != null) _buildPreview(state.selectedPin!),
              ],

              _buildViewToggle(state),

              if (state.isLoading)
                const Positioned(
                  top: 132,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Card(
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            SizedBox(
                              width: 14,
                              height: 14,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            ),
                            SizedBox(width: 10),
                            Text('Searching…'),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMap(DiscoveryState state) {
    final LatLng initialCentre = state.userLocation ??
        LatLng(
          state.filters.lat ?? AppConfig.defaultLat,
          state.filters.lng ?? AppConfig.defaultLng,
        );

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: initialCentre,
        initialZoom: AppConfig.defaultZoom,
        minZoom: AppConfig.minZoom,
        maxZoom: AppConfig.maxZoom,
        onMapEvent: _onMapEvent,
        onTap: (TapPosition _, LatLng __) =>
            context.read<DiscoveryBloc>().add(const PinSelected(null)),
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
        ),
      ),
      children: <Widget>[
        TileLayer(
          urlTemplate: AppConfig.tileUrlTemplate,
          userAgentPackageName: AppConfig.tileUserAgent,
          maxZoom: AppConfig.maxZoom,
        ),
        MarkerLayer(
          markers: <Marker>[
            if (state.userLocation != null)
              Marker(
                point: state.userLocation!,
                width: 36,
                height: 36,
                child: const UserLocationMarker(),
              ),
            ...state.clusters.map((MapCluster cluster) {
              if (cluster.isCluster) {
                return Marker(
                  point: cluster.position,
                  width: 60,
                  height: 60,
                  child: ClusterMarker(
                    cluster: cluster,
                    onTap: () => _onClusterTapped(cluster),
                  ),
                );
              }
              final MapPin pin = cluster.single;
              return Marker(
                point: pin.position,
                width: 44,
                height: 50,
                alignment: Alignment.topCenter,
                child: InstituteMarker(
                  pin: pin,
                  isSelected: state.selectedPinId == pin.id,
                  onTap: () {
                    context.read<DiscoveryBloc>().add(PinSelected(pin.id));
                    _moveCamera(pin.position, _mapController.camera.zoom);
                  },
                ),
              );
            }),
          ],
        ),
        // OSM attribution is required by the tile usage policy.
        const RichAttributionWidget(
          alignment: AttributionAlignment.bottomLeft,
          attributions: <SourceAttribution>[
            TextSourceAttribution('OpenStreetMap contributors'),
          ],
        ),
      ],
    );
  }

  Widget _buildList(DiscoveryState state) {
    if (state.cards.isEmpty && !state.isLoading) {
      return Padding(
        padding: const EdgeInsets.only(top: 140),
        child: EmptyView(
          title: 'No institutes found',
          subtitle: 'Try widening your search or clearing some filters.',
          icon: Icons.search_off_rounded,
          action: FilledButton.tonal(
            onPressed: () =>
                context.read<DiscoveryBloc>().add(const FiltersCleared()),
            child: const Text('Clear filters'),
          ),
        ),
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (ScrollNotification notification) {
        // Prefetch the next page as the user nears the bottom.
        if (notification.metrics.pixels >=
                notification.metrics.maxScrollExtent - 400 &&
            state.hasMore &&
            !state.isLoadingMore) {
          context.read<DiscoveryBloc>().add(const NextPageRequested());
        }
        return false;
      },
      child: RefreshIndicator(
        onRefresh: () async =>
            context.read<DiscoveryBloc>().add(const DiscoveryRefreshed()),
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(12, 148, 12, 96),
          itemCount: state.cards.length + (state.isLoadingMore ? 1 : 0),
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (BuildContext context, int index) {
            if (index >= state.cards.length) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final InstituteCard card = state.cards[index];
            return InstituteListCard(
              card: card,
              onTap: () => context.push('/institute/${card.pin.slug}'),
            );
          },
        ),
      ),
    );
  }

  Widget _buildTopBar(DiscoveryState state) {
    final ThemeData theme = Theme.of(context);

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: Column(
            children: <Widget>[
              Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(28),
                child: TextField(
                  controller: _searchController,
                  textInputAction: TextInputAction.search,
                  onChanged: (String value) => context
                      .read<DiscoveryBloc>()
                      .add(SearchQueryChanged(value)),
                  decoration: InputDecoration(
                    hintText: 'Search institutes, skills, courses',
                    prefixIcon: const Icon(Icons.search),
                    filled: true,
                    fillColor: theme.colorScheme.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(28),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(28),
                      borderSide: BorderSide.none,
                    ),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        if (_searchController.text.isNotEmpty)
                          IconButton(
                            icon: const Icon(Icons.clear, size: 20),
                            onPressed: () {
                              _searchController.clear();
                              context
                                  .read<DiscoveryBloc>()
                                  .add(const SearchQueryChanged(''));
                            },
                          ),
                        Padding(
                          padding: const EdgeInsets.only(right: 4),
                          child: Badge(
                            isLabelVisible: state.filters.activeCount > 0,
                            label: Text('${state.filters.activeCount}'),
                            child: IconButton(
                              icon: const Icon(Icons.tune),
                              tooltip: 'Filters',
                              onPressed: () => _openFilters(state),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              _buildCategoryStrip(state),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryStrip(DiscoveryState state) {
    if (state.categories.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: state.categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (BuildContext context, int index) {
          final CategorySummary category = state.categories[index];
          final bool selected =
              state.filters.categories.contains(category.slug);
          return FilterChip(
            selected: selected,
            avatar: Icon(iconForCategory(category.slug), size: 17),
            label: Text(category.name),
            onSelected: (_) => context
                .read<DiscoveryBloc>()
                .add(CategoryToggled(category.slug)),
            backgroundColor: Theme.of(context).colorScheme.surface,
            elevation: 2,
          );
        },
      ),
    );
  }

  Widget _buildMapControls(DiscoveryState state) {
    return Positioned(
      right: 12,
      bottom: state.selectedPin != null ? 190 : 100,
      child: Column(
        children: <Widget>[
          FloatingActionButton.small(
            heroTag: 'locate',
            onPressed: () {
              context.read<DiscoveryBloc>().add(const LocationRequested());
              final LatLng? here = state.userLocation;
              if (here != null) _moveCamera(here, 15);
            },
            tooltip: 'My location',
            child: Icon(
              state.locationDenied
                  ? Icons.location_disabled
                  : Icons.my_location,
            ),
          ),
          const SizedBox(height: 8),
          FloatingActionButton.small(
            heroTag: 'zoom-in',
            onPressed: () {
              _moveCamera(
                _mapController.camera.center,
                (_mapController.camera.zoom + 1).clamp(
                  AppConfig.minZoom,
                  AppConfig.maxZoom,
                ),
              );
              _publishViewport();
            },
            child: const Icon(Icons.add),
          ),
          const SizedBox(height: 8),
          FloatingActionButton.small(
            heroTag: 'zoom-out',
            onPressed: () {
              _moveCamera(
                _mapController.camera.center,
                (_mapController.camera.zoom - 1).clamp(
                  AppConfig.minZoom,
                  AppConfig.maxZoom,
                ),
              );
              _publishViewport();
            },
            child: const Icon(Icons.remove),
          ),
        ],
      ),
    );
  }

  Widget _buildPreview(MapPin pin) {
    return Positioned(
      left: 12,
      right: 12,
      bottom: 92,
      child: InstitutePreviewCard(
        pin: pin,
        onTap: () => context.push('/institute/${pin.slug}'),
        onClose: () =>
            context.read<DiscoveryBloc>().add(const PinSelected(null)),
      ),
    );
  }

  Widget _buildViewToggle(DiscoveryState state) {
    final bool isMap = state.viewMode == ViewMode.map;
    return Positioned(
      bottom: 24,
      left: 0,
      right: 0,
      child: Center(
        child: FloatingActionButton.extended(
          heroTag: 'view-toggle',
          onPressed: () =>
              context.read<DiscoveryBloc>().add(const ViewModeToggled()),
          icon: Icon(isMap ? Icons.view_list_rounded : Icons.map_rounded),
          label: Text(
            isMap ? 'List (${state.total})' : 'Map',
          ),
        ),
      ),
    );
  }

  Future<void> _openFilters(DiscoveryState state) async {
    final DiscoveryBloc bloc = context.read<DiscoveryBloc>();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext sheetContext) => FilterSheet(
        initial: state.filters,
        categories: state.categories,
        skills: state.availableSkills,
        onApply: (filters) => bloc.add(FiltersChanged(filters)),
        onClear: () => bloc.add(const FiltersCleared()),
      ),
    );
  }
}
