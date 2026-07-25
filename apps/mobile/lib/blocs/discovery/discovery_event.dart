part of 'discovery_bloc.dart';

sealed class DiscoveryEvent extends Equatable {
  const DiscoveryEvent();

  @override
  List<Object?> get props => <Object?>[];
}

/// Loads categories/skills and performs the first search.
class DiscoveryStarted extends DiscoveryEvent {
  const DiscoveryStarted();
}

/// The map stopped moving; refetch pins for the new viewport.
class MapViewportChanged extends DiscoveryEvent {
  const MapViewportChanged({
    required this.center,
    required this.zoom,
    required this.bounds,
  });

  final LatLng center;
  final double zoom;

  /// [minLng, minLat, maxLng, maxLat]
  final List<double> bounds;

  @override
  List<Object?> get props => <Object?>[center, zoom, bounds];
}

class FiltersChanged extends DiscoveryEvent {
  const FiltersChanged(this.filters);

  final DiscoveryFilters filters;

  @override
  List<Object?> get props => <Object?>[filters];
}

class SearchQueryChanged extends DiscoveryEvent {
  const SearchQueryChanged(this.query);

  final String query;

  @override
  List<Object?> get props => <Object?>[query];
}

class ViewModeToggled extends DiscoveryEvent {
  const ViewModeToggled();
}

class CategoryToggled extends DiscoveryEvent {
  const CategoryToggled(this.slug);

  final String slug;

  @override
  List<Object?> get props => <Object?>[slug];
}

class PinSelected extends DiscoveryEvent {
  const PinSelected(this.pinId);

  final String? pinId;

  @override
  List<Object?> get props => <Object?>[pinId];
}

/// Requests GPS permission and centres the map on the user.
class LocationRequested extends DiscoveryEvent {
  const LocationRequested();
}

class NextPageRequested extends DiscoveryEvent {
  const NextPageRequested();
}

class DiscoveryRefreshed extends DiscoveryEvent {
  const DiscoveryRefreshed();
}

class FiltersCleared extends DiscoveryEvent {
  const FiltersCleared();
}
