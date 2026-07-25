import 'package:flutter_test/flutter_test.dart';
import 'package:institutes_app/core/validation/form_validator.dart';
import 'package:institutes_app/data/models/dynamic_form.dart';
import 'package:institutes_app/data/models/enums.dart';

/// These tests pin the client validator to the exact behaviour of the server's
/// shared validator (packages/shared/src/validation.ts). If one changes, the
/// other must change too, and these tests should catch the drift.
void main() {
  FormFieldSchema field(
    FormFieldType type, {
    bool required = false,
    int? minLength,
    int? maxLength,
    double? min,
    double? max,
    String? pattern,
    List<FormFieldOption> options = const <FormFieldOption>[],
  }) {
    return FormFieldSchema(
      key: 'f',
      label: 'Field',
      type: type,
      required: required,
      position: 0,
      minLength: minLength,
      maxLength: maxLength,
      min: min,
      max: max,
      pattern: pattern,
      options: options,
    );
  }

  group('digit normalization', () {
    test('converts Persian digits to ASCII', () {
      expect(FormValidator.normalizeDigits('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
    });

    test('converts Arabic-Indic digits to ASCII', () {
      expect(FormValidator.normalizeDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
    });

    test('leaves ASCII untouched', () {
      expect(FormValidator.normalizeDigits('abc123'), 'abc123');
    });
  });

  group('mobile numbers', () {
    test('accepts every common Iranian format', () {
      for (final String input in <String>[
        '09123456789',
        '+989123456789',
        '00989123456789',
        '989123456789',
        '9123456789',
        '0912 345 6789',
        '۰۹۱۲۳۴۵۶۷۸۹',
      ]) {
        expect(FormValidator.isValidMobile(input), isTrue, reason: input);
      }
    });

    test('rejects malformed numbers', () {
      for (final String input in <String>[
        '0812345678',
        '091234567',
        '091234567890',
        'not-a-number',
        '',
      ]) {
        expect(FormValidator.isValidMobile(input), isFalse, reason: input);
      }
    });

    test('normalizes to the canonical 09xxxxxxxxx form', () {
      expect(FormValidator.normalizeMobile('+989123456789'), '09123456789');
      expect(FormValidator.normalizeMobile('00989123456789'), '09123456789');
      expect(FormValidator.normalizeMobile('9123456789'), '09123456789');
      expect(FormValidator.normalizeMobile('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
    });
  });

  group('national ID checksum', () {
    test('accepts valid IDs', () {
      // Checksums verified against the published algorithm.
      expect(FormValidator.isValidNationalId('0499370899'), isTrue);
      expect(FormValidator.isValidNationalId('0790419904'), isTrue);
    });

    test('rejects wrong length, repeated digits and bad checksums', () {
      expect(FormValidator.isValidNationalId('123'), isFalse);
      expect(FormValidator.isValidNationalId('1111111111'), isFalse);
      expect(FormValidator.isValidNationalId('0499370898'), isFalse);
    });
  });

  group('required handling', () {
    test('required field rejects null and blank', () {
      final FormFieldSchema f = field(FormFieldType.text, required: true);
      expect(FormValidator.validateField(f, null), isNotNull);
      expect(FormValidator.validateField(f, '   '), isNotNull);
    });

    test('optional field accepts empty', () {
      final FormFieldSchema f = field(FormFieldType.text);
      expect(FormValidator.validateField(f, null), isNull);
      expect(FormValidator.validateField(f, ''), isNull);
    });

    test('required checkbox must be true', () {
      final FormFieldSchema f = field(FormFieldType.checkbox, required: true);
      expect(FormValidator.validateField(f, false), isNotNull);
      expect(FormValidator.validateField(f, true), isNull);
    });
  });

  group('text constraints', () {
    test('enforces min and max length', () {
      final FormFieldSchema f =
          field(FormFieldType.text, minLength: 3, maxLength: 5);
      expect(FormValidator.validateField(f, 'ab'), isNotNull);
      expect(FormValidator.validateField(f, 'abcdef'), isNotNull);
      expect(FormValidator.validateField(f, 'abcd'), isNull);
    });

    test('enforces a regex pattern', () {
      final FormFieldSchema f = field(FormFieldType.text, pattern: r'^[A-Z]+$');
      expect(FormValidator.validateField(f, 'abc'), isNotNull);
      expect(FormValidator.validateField(f, 'ABC'), isNull);
    });

    test('an invalid admin regex does not block the student', () {
      final FormFieldSchema f = field(FormFieldType.text, pattern: '([');
      expect(FormValidator.validateField(f, 'anything'), isNull);
    });
  });

  group('numbers', () {
    test('enforces min and max', () {
      final FormFieldSchema f = field(FormFieldType.number, min: 5, max: 10);
      expect(FormValidator.validateField(f, 4), isNotNull);
      expect(FormValidator.validateField(f, 11), isNotNull);
      expect(FormValidator.validateField(f, 7), isNull);
    });

    test('accepts numeric strings, including Persian digits', () {
      final FormFieldSchema f = field(FormFieldType.number, min: 0, max: 100);
      expect(FormValidator.validateField(f, '42'), isNull);
      expect(FormValidator.validateField(f, '۴۲'), isNull);
      expect(FormValidator.validateField(f, 'abc'), isNotNull);
    });
  });

  group('choice fields', () {
    final List<FormFieldOption> options = <FormFieldOption>[
      const FormFieldOption(label: 'A', value: 'a'),
      const FormFieldOption(label: 'B', value: 'b'),
    ];

    test('select rejects unknown values', () {
      final FormFieldSchema f =
          field(FormFieldType.select, options: options);
      expect(FormValidator.validateField(f, 'a'), isNull);
      expect(FormValidator.validateField(f, 'z'), isNotNull);
    });

    test('multiSelect rejects any unknown entry', () {
      final FormFieldSchema f =
          field(FormFieldType.multiSelect, options: options);
      expect(FormValidator.validateField(f, <String>['a', 'b']), isNull);
      expect(FormValidator.validateField(f, <String>['a', 'z']), isNotNull);
    });
  });

  group('dates and files', () {
    test('date must be ISO yyyy-MM-dd and real', () {
      final FormFieldSchema f = field(FormFieldType.date);
      expect(FormValidator.validateField(f, '2026-07-25'), isNull);
      expect(FormValidator.validateField(f, '25-07-2026'), isNotNull);
      expect(FormValidator.validateField(f, '2026-13-45'), isNotNull);
    });

    test('file requires mediaId and fileName', () {
      final FormFieldSchema f = field(FormFieldType.file);
      expect(
        FormValidator.validateField(
          f,
          <String, String>{'mediaId': 'm1', 'fileName': 'cv.pdf'},
        ),
        isNull,
      );
      expect(
        FormValidator.validateField(f, <String, String>{'mediaId': 'm1'}),
        isNotNull,
      );
    });
  });

  group('whole-form validation and sanitization', () {
    final List<FormFieldSchema> schema = <FormFieldSchema>[
      FormFieldSchema(
        key: 'name',
        label: 'Name',
        type: FormFieldType.text,
        required: true,
        position: 0,
      ),
      FormFieldSchema(
        key: 'mobile',
        label: 'Mobile',
        type: FormFieldType.phone,
        required: true,
        position: 1,
      ),
      FormFieldSchema(
        key: 'mail',
        label: 'Email',
        type: FormFieldType.email,
        required: false,
        position: 2,
      ),
    ];

    test('collects one error per invalid field', () {
      final Map<String, String> errors = FormValidator.validateAll(
        schema,
        <String, dynamic>{'name': '', 'mobile': 'nope'},
      );
      expect(errors.keys, containsAll(<String>['name', 'mobile']));
      expect(errors.containsKey('mail'), isFalse);
    });

    test('passes a valid submission', () {
      final Map<String, String> errors = FormValidator.validateAll(
        schema,
        <String, dynamic>{
          'name': 'Sara',
          'mobile': '+989123456789',
          'mail': 'SARA@Example.COM ',
        },
      );
      expect(errors, isEmpty);
    });

    test('sanitizes values the way the server stores them', () {
      final Map<String, dynamic> clean = FormValidator.sanitizeAll(
        schema,
        <String, dynamic>{
          'name': '  Sara  ',
          'mobile': '+989123456789',
          'mail': ' SARA@Example.COM ',
        },
      );
      expect(clean['name'], 'Sara');
      expect(clean['mobile'], '09123456789');
      expect(clean['mail'], 'sara@example.com');
    });

    test('unknown keys are dropped from the payload', () {
      final Map<String, dynamic> clean = FormValidator.sanitizeAll(
        schema,
        <String, dynamic>{'name': 'Sara', 'mobile': '09123456789', 'evil': 1},
      );
      expect(clean.containsKey('evil'), isFalse);
    });
  });
}
