import '../../data/models/dynamic_form.dart';
import '../../data/models/enums.dart';

/// Dart port of `packages/shared/src/validation.ts`.
///
/// The server re-runs the identical rules before persisting a submission, so
/// keeping these in lockstep means the user never sees a field accepted here
/// and rejected there. Any change to one must be mirrored in the other.
class FormValidator {
  const FormValidator._();

  static final RegExp _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');
  static final RegExp _irMobile = RegExp(r'^(?:\+98|0098|98|0)?9\d{9}$');
  static final RegExp _isoDate = RegExp(r'^\d{4}-\d{2}-\d{2}$');
  static final RegExp _nonDigit = RegExp(r'\D');
  static final RegExp _spacesAndDashes = RegExp(r'[\s-]');

  /// Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII.
  static String normalizeDigits(String input) {
    const String persian = '۰۱۲۳۴۵۶۷۸۹';
    const String arabic = '٠١٢٣٤٥٦٧٨٩';
    final StringBuffer buffer = StringBuffer();
    for (final int rune in input.runes) {
      final String ch = String.fromCharCode(rune);
      final int p = persian.indexOf(ch);
      if (p >= 0) {
        buffer.write(p);
        continue;
      }
      final int a = arabic.indexOf(ch);
      if (a >= 0) {
        buffer.write(a);
        continue;
      }
      buffer.write(ch);
    }
    return buffer.toString();
  }

  static bool isValidEmail(String value) => _email.hasMatch(value.trim());

  static bool isValidMobile(String value) => _irMobile
      .hasMatch(normalizeDigits(value).replaceAll(_spacesAndDashes, ''));

  /// Canonical `09xxxxxxxxx` form.
  static String normalizeMobile(String value) {
    final String digits =
        normalizeDigits(value).replaceAll(RegExp(r'[^\d+]'), '');
    final String stripped = digits
        .replaceFirst(RegExp(r'^(\+98|0098|98)'), '')
        .replaceFirst(RegExp(r'^0'), '');
    return '0$stripped';
  }

  /// Iranian national ID checksum (کد ملی).
  static bool isValidNationalId(String value) {
    final String id = normalizeDigits(value).replaceAll(_nonDigit, '');
    if (id.length != 10) return false;
    if (RegExp(r'^(\d)\1{9}$').hasMatch(id)) return false;

    final int check = int.parse(id[9]);
    int sum = 0;
    for (int i = 0; i < 9; i++) {
      sum += int.parse(id[i]) * (10 - i);
    }
    final int remainder = sum % 11;
    return remainder < 2 ? check == remainder : check == 11 - remainder;
  }

  static bool _isEmpty(dynamic value) {
    if (value == null) return true;
    if (value is String) return value.trim().isEmpty;
    if (value is List) return value.isEmpty;
    return false;
  }

  /// Validates one field. Returns `null` when acceptable.
  static String? validateField(FormFieldSchema field, dynamic value) {
    if (_isEmpty(value)) {
      return field.required ? '${field.label} is required' : null;
    }

    switch (field.type) {
      case FormFieldType.text:
      case FormFieldType.textarea:
        if (value is! String) return '${field.label} must be text';
        final String text = value.trim();
        if (field.minLength != null && text.length < field.minLength!) {
          return '${field.label} must be at least ${field.minLength} characters';
        }
        if (field.maxLength != null && text.length > field.maxLength!) {
          return '${field.label} must be at most ${field.maxLength} characters';
        }
        final String? pattern = field.pattern;
        if (pattern != null && pattern.isNotEmpty) {
          try {
            if (!RegExp(pattern).hasMatch(text)) {
              return '${field.label} has an invalid format';
            }
          } on FormatException {
            // A broken admin-supplied pattern must not block the student.
            return null;
          }
        }
        return null;

      case FormFieldType.number:
        final double? parsed = value is num
            ? value.toDouble()
            : double.tryParse(normalizeDigits(value.toString()));
        if (parsed == null) return '${field.label} must be a number';
        if (field.min != null && parsed < field.min!) {
          return '${field.label} must be at least ${_trim(field.min!)}';
        }
        if (field.max != null && parsed > field.max!) {
          return '${field.label} must be at most ${_trim(field.max!)}';
        }
        return null;

      case FormFieldType.email:
        if (value is! String || !isValidEmail(value)) {
          return '${field.label} must be a valid email address';
        }
        return null;

      case FormFieldType.phone:
        if (value is! String || !isValidMobile(value)) {
          return '${field.label} must be a valid mobile number';
        }
        return null;

      case FormFieldType.nationalId:
        if (value is! String || !isValidNationalId(value)) {
          return '${field.label} must be a valid national ID';
        }
        return null;

      case FormFieldType.date:
        if (value is! String || !_isoDate.hasMatch(value)) {
          return '${field.label} must be a date (YYYY-MM-DD)';
        }
        if (DateTime.tryParse('${value}T00:00:00Z') == null) {
          return '${field.label} is not a real date';
        }
        return null;

      case FormFieldType.select:
        if (value is! String) return '${field.label} must be a single choice';
        final bool known =
            field.options.any((FormFieldOption o) => o.value == value);
        if (!known) return '${field.label} has an unsupported option';
        return null;

      case FormFieldType.multiSelect:
        if (value is! List) return '${field.label} must be a list of choices';
        final Set<String> allowed =
            field.options.map((FormFieldOption o) => o.value).toSet();
        final List<String> invalid = value
            .map((dynamic e) => e.toString())
            .where((String v) => !allowed.contains(v))
            .toList();
        if (invalid.isNotEmpty) {
          return '${field.label} has unsupported options: ${invalid.join(', ')}';
        }
        return null;

      case FormFieldType.checkbox:
        if (value is! bool) return '${field.label} must be true or false';
        if (field.required && !value) return '${field.label} must be accepted';
        return null;

      case FormFieldType.file:
        if (value is! Map ||
            value['mediaId'] is! String ||
            value['fileName'] is! String) {
          return '${field.label} must be an uploaded file';
        }
        return null;
    }
  }

  /// Normalizes a value the same way the server does before storing it.
  static dynamic sanitizeValue(FormFieldSchema field, dynamic value) {
    if (_isEmpty(value)) return null;
    switch (field.type) {
      case FormFieldType.text:
      case FormFieldType.textarea:
        return value is String ? value.trim() : value;
      case FormFieldType.number:
        return value is num
            ? value
            : double.tryParse(normalizeDigits(value.toString()));
      case FormFieldType.email:
        return value is String ? value.trim().toLowerCase() : value;
      case FormFieldType.phone:
        return value is String ? normalizeMobile(value) : value;
      case FormFieldType.nationalId:
        return value is String
            ? normalizeDigits(value).replaceAll(_nonDigit, '')
            : value;
      default:
        return value;
    }
  }

  /// Validates a whole submission, returning `{fieldKey: errorMessage}`.
  static Map<String, String> validateAll(
    List<FormFieldSchema> fields,
    Map<String, dynamic> data,
  ) {
    final Map<String, String> errors = <String, String>{};
    for (final FormFieldSchema field in fields) {
      final String? error = validateField(field, data[field.key]);
      if (error != null) errors[field.key] = error;
    }
    return errors;
  }

  /// Builds the sanitized payload to POST.
  static Map<String, dynamic> sanitizeAll(
    List<FormFieldSchema> fields,
    Map<String, dynamic> data,
  ) {
    final Map<String, dynamic> result = <String, dynamic>{};
    for (final FormFieldSchema field in fields) {
      result[field.key] = sanitizeValue(field, data[field.key]);
    }
    return result;
  }

  static String _trim(double value) =>
      value == value.roundToDouble() ? value.toInt().toString() : value.toString();
}
