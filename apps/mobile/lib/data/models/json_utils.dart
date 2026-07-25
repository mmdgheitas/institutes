/// Defensive JSON coercion helpers.
///
/// The API is trusted but versions drift: a field that is an int today may be
/// a string tomorrow (Postgres `numeric` arrives as a string, for instance).
/// These helpers make parsing total, so a surprise type never crashes a screen.
library;

double asDouble(dynamic value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

double? asDoubleOrNull(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

int asInt(dynamic value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

int? asIntOrNull(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

bool asBool(dynamic value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    final String v = value.toLowerCase();
    if (v == 'true' || v == '1') return true;
    if (v == 'false' || v == '0') return false;
  }
  return fallback;
}

String asString(dynamic value, {String fallback = ''}) {
  if (value == null) return fallback;
  if (value is String) return value;
  return value.toString();
}

String? asStringOrNull(dynamic value) {
  if (value == null) return null;
  if (value is String) return value.isEmpty ? null : value;
  return value.toString();
}

DateTime? asDateOrNull(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value)?.toLocal();
  return null;
}

DateTime asDate(dynamic value) => asDateOrNull(value) ?? DateTime.now();

List<String> asStringList(dynamic value) {
  if (value is List) {
    return value
        .where((dynamic e) => e != null)
        .map((dynamic e) => e.toString())
        .toList(growable: false);
  }
  return const <String>[];
}

Map<String, dynamic> asMap(dynamic value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

/// Maps a JSON list into models, skipping entries that are not objects.
List<T> asModelList<T>(
  dynamic value,
  T Function(Map<String, dynamic> json) parse,
) {
  if (value is! List) return <T>[];
  final List<T> result = <T>[];
  for (final dynamic item in value) {
    if (item is Map) {
      result.add(parse(Map<String, dynamic>.from(item)));
    }
  }
  return result;
}
