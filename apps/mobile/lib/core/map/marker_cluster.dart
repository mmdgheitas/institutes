import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

import '../../data/models/institute.dart';

/// A rendered map item: either a single institute or a group of them.
class MapCluster {
  const MapCluster({
    required this.position,
    required this.pins,
  });

  final LatLng position;
  final List<MapPin> pins;

  bool get isCluster => pins.length > 1;
  int get count => pins.length;
  MapPin get single => pins.first;

  /// Colour of the most common category in the cluster, for the badge.
  String get dominantColor {
    if (pins.length == 1) return pins.first.categoryColor;
    final Map<String, int> tally = <String, int>{};
    for (final MapPin pin in pins) {
      tally[pin.categoryColor] = (tally[pin.categoryColor] ?? 0) + 1;
    }
    return tally.entries
        .reduce((MapEntry<String, int> a, MapEntry<String, int> b) =>
            a.value >= b.value ? a : b)
        .key;
  }
}

/// Grid-based marker clustering.
///
/// Chosen over a k-d tree deliberately: it is O(n) per frame, stable while
/// panning (a pin never jumps between clusters unless the zoom changes), and
/// fast enough for the few hundred pins a viewport returns. Cells are sized in
/// screen pixels then converted to degrees, so cluster density looks consistent
/// at every zoom level.
class MarkerClusterer {
  const MarkerClusterer({this.cellSizePixels = 90});

  /// Approximate pixel width of one grid cell.
  final double cellSizePixels;

  /// Web-mercator world size in pixels at [zoom] (256px tiles).
  static double _worldPixels(double zoom) => 256.0 * math.pow(2, zoom);

  /// Groups [pins] for the given [zoom]. Above [disableAboveZoom] every pin is
  /// returned individually, since at street level clustering hides detail.
  List<MapCluster> cluster(
    List<MapPin> pins,
    double zoom, {
    double disableAboveZoom = 16,
  }) {
    if (pins.isEmpty) return const <MapCluster>[];

    if (zoom >= disableAboveZoom) {
      return pins
          .map((MapPin p) => MapCluster(position: p.position, pins: <MapPin>[p]))
          .toList(growable: false);
    }

    final double world = _worldPixels(zoom);
    // Degrees of longitude covered by one cell at this zoom.
    final double cellDegrees = (cellSizePixels / world) * 360.0;
    // Guard against a degenerate cell size at extreme zooms.
    final double step = cellDegrees <= 0 ? 0.0001 : cellDegrees;

    final Map<String, List<MapPin>> buckets = <String, List<MapPin>>{};
    for (final MapPin pin in pins) {
      // Latitude cells are scaled by cos(lat) so cells stay roughly square.
      final double latScale =
          math.max(0.15, math.cos(pin.lat * math.pi / 180.0));
      final int col = (pin.lng / step).floor();
      final int row = (pin.lat / (step * latScale)).floor();
      buckets.putIfAbsent('$col:$row', () => <MapPin>[]).add(pin);
    }

    final List<MapCluster> clusters = <MapCluster>[];
    for (final List<MapPin> bucket in buckets.values) {
      if (bucket.length == 1) {
        clusters.add(
          MapCluster(position: bucket.first.position, pins: bucket),
        );
        continue;
      }

      // Centroid of the group.
      double latSum = 0;
      double lngSum = 0;
      for (final MapPin pin in bucket) {
        latSum += pin.lat;
        lngSum += pin.lng;
      }
      clusters.add(
        MapCluster(
          position: LatLng(latSum / bucket.length, lngSum / bucket.length),
          pins: bucket,
        ),
      );
    }

    return clusters;
  }
}

/// Great-circle distance in meters, mirroring the shared TS helper.
double haversineMeters(LatLng a, LatLng b) {
  const double earthRadius = 6371008.8;
  double toRad(double deg) => deg * math.pi / 180.0;

  final double dLat = toRad(b.latitude - a.latitude);
  final double dLng = toRad(b.longitude - a.longitude);
  final double lat1 = toRad(a.latitude);
  final double lat2 = toRad(b.latitude);

  final double h = math.pow(math.sin(dLat / 2), 2).toDouble() +
      math.cos(lat1) * math.cos(lat2) * math.pow(math.sin(dLng / 2), 2);

  return 2 * earthRadius * math.asin(math.min(1.0, math.sqrt(h)));
}

/// "820 m" / "3.4 km"
String formatDistance(num meters) {
  if (meters < 0) return '—';
  if (meters < 1000) return '${meters.round()} m';
  if (meters < 10000) return '${(meters / 1000).toStringAsFixed(1)} km';
  return '${(meters / 1000).round()} km';
}
