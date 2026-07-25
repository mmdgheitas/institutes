import 'package:equatable/equatable.dart';

import 'enums.dart';
import 'json_utils.dart';

class FormFieldOption extends Equatable {
  const FormFieldOption({required this.label, required this.value});

  final String label;
  final String value;

  factory FormFieldOption.fromJson(Map<String, dynamic> json) =>
      FormFieldOption(
        label: asString(json['label']),
        value: asString(json['value']),
      );

  @override
  List<Object?> get props => <Object?>[value];
}

/// One field of an institute's custom pre-registration form.
class FormFieldSchema extends Equatable {
  const FormFieldSchema({
    required this.key,
    required this.label,
    required this.type,
    required this.required,
    required this.position,
    this.placeholder,
    this.helpText,
    this.options = const <FormFieldOption>[],
    this.minLength,
    this.maxLength,
    this.min,
    this.max,
    this.pattern,
    this.acceptedMimeTypes = const <String>[],
    this.maxFileSizeMb = 10,
  });

  final String key;
  final String label;
  final FormFieldType type;
  final bool required;
  final int position;
  final String? placeholder;
  final String? helpText;
  final List<FormFieldOption> options;
  final int? minLength;
  final int? maxLength;
  final double? min;
  final double? max;
  final String? pattern;
  final List<String> acceptedMimeTypes;
  final int maxFileSizeMb;

  factory FormFieldSchema.fromJson(Map<String, dynamic> json) =>
      FormFieldSchema(
        key: asString(json['key']),
        label: asString(json['label']),
        type: FormFieldType.parse(asStringOrNull(json['type'])),
        required: asBool(json['required']),
        position: asInt(json['position']),
        placeholder: asStringOrNull(json['placeholder']),
        helpText: asStringOrNull(json['helpText']),
        options: asModelList(json['options'], FormFieldOption.fromJson),
        minLength: asIntOrNull(json['minLength']),
        maxLength: asIntOrNull(json['maxLength']),
        min: asDoubleOrNull(json['min']),
        max: asDoubleOrNull(json['max']),
        pattern: asStringOrNull(json['pattern']),
        acceptedMimeTypes: asStringList(json['acceptedMimeTypes']),
        maxFileSizeMb: asInt(json['maxFileSizeMb'], fallback: 10),
      );

  @override
  List<Object?> get props => <Object?>[key, type, required];
}

class FormSchema extends Equatable {
  const FormSchema({
    required this.id,
    required this.instituteId,
    required this.title,
    required this.isActive,
    required this.requiresContract,
    required this.fields,
    this.description,
    this.contractText,
  });

  final String id;
  final String instituteId;
  final String title;
  final bool isActive;
  final bool requiresContract;
  final List<FormFieldSchema> fields;
  final String? description;
  final String? contractText;

  factory FormSchema.fromJson(Map<String, dynamic> json) {
    final List<FormFieldSchema> parsed =
        asModelList(json['fields'], FormFieldSchema.fromJson);
    // The server sorts already; sorting again keeps the UI stable regardless.
    parsed.sort((FormFieldSchema a, FormFieldSchema b) =>
        a.position.compareTo(b.position));
    return FormSchema(
      id: asString(json['id']),
      instituteId: asString(json['instituteId']),
      title: asString(json['title']),
      isActive: asBool(json['isActive'], fallback: true),
      requiresContract: asBool(json['requiresContract']),
      fields: parsed,
      description: asStringOrNull(json['description']),
      contractText: asStringOrNull(json['contractText']),
    );
  }

  @override
  List<Object?> get props => <Object?>[id, fields.length];
}

/// A bookable assessment / interview slot.
class TimeSlot extends Equatable {
  const TimeSlot({
    required this.id,
    required this.instituteId,
    required this.startsAt,
    required this.endsAt,
    required this.capacity,
    required this.bookedCount,
    this.courseId,
    this.location,
  });

  final String id;
  final String instituteId;
  final DateTime startsAt;
  final DateTime endsAt;
  final int capacity;
  final int bookedCount;
  final String? courseId;
  final String? location;

  bool get isFull => bookedCount >= capacity;
  int get seatsLeft => capacity - bookedCount;

  factory TimeSlot.fromJson(Map<String, dynamic> json) => TimeSlot(
        id: asString(json['id']),
        instituteId: asString(json['instituteId']),
        startsAt: asDate(json['startsAt']),
        endsAt: asDate(json['endsAt']),
        capacity: asInt(json['capacity'], fallback: 1),
        bookedCount: asInt(json['bookedCount']),
        courseId: asStringOrNull(json['courseId']),
        location: asStringOrNull(json['location']),
      );

  @override
  List<Object?> get props => <Object?>[id, bookedCount];
}

/// A student's own pre-registration record.
class MySubmission extends Equatable {
  const MySubmission({
    required this.id,
    required this.status,
    required this.instituteId,
    required this.instituteName,
    required this.instituteSlug,
    required this.formTitle,
    required this.createdAt,
    this.courseTitle,
  });

  final String id;
  final LeadStatus status;
  final String instituteId;
  final String instituteName;
  final String instituteSlug;
  final String formTitle;
  final DateTime createdAt;
  final String? courseTitle;

  factory MySubmission.fromJson(Map<String, dynamic> json) => MySubmission(
        id: asString(json['id']),
        status: LeadStatus.parse(asStringOrNull(json['status'])),
        instituteId: asString(json['institute_id'] ?? json['instituteId']),
        instituteName:
            asString(json['institute_name'] ?? json['instituteName']),
        instituteSlug:
            asString(json['institute_slug'] ?? json['instituteSlug']),
        formTitle: asString(json['form_title'] ?? json['formTitle']),
        createdAt: asDate(json['created_at'] ?? json['createdAt']),
        courseTitle:
            asStringOrNull(json['course_title'] ?? json['courseTitle']),
      );

  @override
  List<Object?> get props => <Object?>[id, status];
}
