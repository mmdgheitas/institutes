import 'package:flutter_test/flutter_test.dart';
import 'package:institutes_app/core/map/marker_cluster.dart';
import 'package:institutes_app/data/models/enums.dart';
import 'package:institutes_app/data/models/institute.dart';
import 'package:latlong2/latlong.dart';

MapPin pin(String id, double lat, double lng, {String color = '#2563eb'}) {
  return MapPin(
    id: id,
    slug: id,
    name: id,
    lat: lat,
    lng: lng,
    categorySlug: 'languages',
    categoryColor: color,
    categoryIcon: 'translate',
    rating: 4.5,
    reviewCount: 10,
    verificationStatus: VerificationStatus.verified,
    hasOnlineCourses: true,
    hasActiveDiscount: false,
    freePreRegistration: true,
  );
}

void main() {
  const MarkerClusterer clusterer = MarkerClusterer();

  group('clustering', () {
    test('empty input produces no clusters', () {
      expect(clusterer.cluster(<MapPin>[], 12), isEmpty);
    });

    test('a single pin is never a cluster', () {
      final List<MapCluster> result =
          clusterer.cluster(<MapPin>[pin('a', 35.72, 51.33)], 12);
      expect(result, hasLength(1));
      expect(result.first.isCluster, isFalse);
      expect(result.first.count, 1);
    });

    test('nearby pins group together at low zoom', () {
      final List<MapPin> pins = <MapPin>[
        pin('a', 35.7200, 51.3300),
        pin('b', 35.7201, 51.3301),
        pin('c', 35.7202, 51.3302),
      ];
      final List<MapCluster> result = clusterer.cluster(pins, 10);
      expect(result, hasLength(1));
      expect(result.first.count, 3);
      expect(result.first.isCluster, isTrue);
    });

    test('far-apart pins stay separate', () {
      final List<MapPin> pins = <MapPin>[
        pin('a', 35.72, 51.33),
        pin('b', 36.80, 54.40),
      ];
      expect(clusterer.cluster(pins, 12), hasLength(2));
    });

    test('clustering is disabled above the street-level threshold', () {
      final List<MapPin> pins = <MapPin>[
        pin('a', 35.7200, 51.3300),
        pin('b', 35.7200, 51.3300),
      ];
      final List<MapCluster> result = clusterer.cluster(pins, 17);
      expect(result, hasLength(2));
      expect(result.every((MapCluster c) => !c.isCluster), isTrue);
    });

    test('every pin survives clustering', () {
      final List<MapPin> pins = List<MapPin>.generate(
        60,
        (int i) => pin('p$i', 35.70 + (i % 8) * 0.01, 51.30 + (i ~/ 8) * 0.01),
      );
      for (final double zoom in <double>[6, 9, 12, 14]) {
        final List<MapCluster> result = clusterer.cluster(pins, zoom);
        final int total =
            result.fold(0, (int sum, MapCluster c) => sum + c.count);
        expect(total, pins.length, reason: 'zoom $zoom lost pins');
      }
    });

    test('zooming in never produces fewer groups', () {
      final List<MapPin> pins = List<MapPin>.generate(
        40,
        (int i) => pin('p$i', 35.70 + i * 0.004, 51.30 + i * 0.004),
      );
      final int atLowZoom = clusterer.cluster(pins, 8).length;
      final int atHighZoom = clusterer.cluster(pins, 14).length;
      expect(atHighZoom, greaterThanOrEqualTo(atLowZoom));
    });

    test('cluster centroid sits between its members', () {
      final List<MapPin> pins = <MapPin>[
        pin('a', 35.7200, 51.3300),
        pin('b', 35.7220, 51.3320),
      ];
      final List<MapCluster> result = clusterer.cluster(pins, 9);
      if (result.first.isCluster) {
        expect(result.first.position.latitude, closeTo(35.7210, 0.001));
        expect(result.first.position.longitude, closeTo(51.3310, 0.001));
      }
    });

    test('dominant colour is the most frequent category colour', () {
      final List<MapPin> pins = <MapPin>[
        pin('a', 35.7200, 51.3300, color: '#ff0000'),
        pin('b', 35.7201, 51.3301, color: '#ff0000'),
        pin('c', 35.7202, 51.3302, color: '#00ff00'),
      ];
      final List<MapCluster> result = clusterer.cluster(pins, 9);
      expect(result.first.dominantColor, '#ff0000');
    });
  });

  group('haversine distance', () {
    test('zero for identical points', () {
      const LatLng p = LatLng(35.72, 51.33);
      expect(haversineMeters(p, p), closeTo(0, 0.001));
    });

    test('one degree of latitude is about 111 km', () {
      expect(
        haversineMeters(const LatLng(35, 51), const LatLng(36, 51)),
        closeTo(111195, 500),
      );
    });

    test('is symmetric', () {
      const LatLng a = LatLng(35.72, 51.33);
      const LatLng b = LatLng(36.30, 59.60);
      expect(haversineMeters(a, b), closeTo(haversineMeters(b, a), 0.001));
    });

    test('Tehran to Mashhad is roughly 740 km', () {
      final double d = haversineMeters(
        const LatLng(35.6892, 51.3890),
        const LatLng(36.2605, 59.6168),
      );
      expect(d / 1000, closeTo(740, 30));
    });
  });

  group('distance formatting', () {
    test('formats metres, kilometres and rounds appropriately', () {
      expect(formatDistance(0), '0 m');
      expect(formatDistance(820), '820 m');
      expect(formatDistance(999), '999 m');
      expect(formatDistance(1000), '1.0 km');
      expect(formatDistance(3400), '3.4 km');
      expect(formatDistance(15000), '15 km');
    });

    test('negative input is rendered as unknown', () {
      expect(formatDistance(-5), '—');
    });
  });
}
