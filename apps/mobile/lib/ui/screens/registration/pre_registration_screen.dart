import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/validation/form_validator.dart';
import '../../../data/models/dynamic_form.dart';
import '../../../data/models/enums.dart';
import '../../../data/repositories/enrollment_repository.dart';
import '../../../data/repositories/upload_repository.dart';
import '../../widgets/common.dart';
import '../../widgets/dynamic_field.dart';

/// Three-step pre-registration wizard: dynamic form → slot booking → contract.
class PreRegistrationScreen extends StatefulWidget {
  const PreRegistrationScreen({
    super.key,
    required this.formId,
    required this.instituteSlug,
    required this.repository,
    required this.uploads,
    this.courseId,
  });

  final String formId;
  final String instituteSlug;
  final EnrollmentRepository repository;
  final UploadRepository uploads;
  final String? courseId;

  @override
  State<PreRegistrationScreen> createState() => _PreRegistrationScreenState();
}

class _PreRegistrationScreenState extends State<PreRegistrationScreen> {
  FormSchema? _schema;
  List<TimeSlot> _slots = <TimeSlot>[];
  String? _loadError;
  bool _loading = true;

  int _step = 0;
  final Map<String, dynamic> _answers = <String, dynamic>{};
  Map<String, String> _errors = <String, String>{};
  String? _selectedSlotId;
  bool _contractAccepted = false;
  bool _submitting = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final FormSchema schema = await widget.repository.getForm(widget.formId);
      List<TimeSlot> slots = <TimeSlot>[];
      try {
        slots = await widget.repository.availableSlots(
          schema.instituteId,
          courseId: widget.courseId,
        );
      } on ApiException {
        // Slots are optional; a failure here must not block the form.
      }
      if (!mounted) return;
      setState(() {
        _schema = schema;
        _slots = slots;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error.message;
        _loading = false;
      });
    }
  }

  /// Steps: 0 = form, 1 = slot (only when slots exist), 2 = contract.
  List<int> get _activeSteps {
    final FormSchema? schema = _schema;
    return <int>[
      0,
      if (_slots.isNotEmpty) 1,
      if (schema?.requiresContract ?? false) 2,
    ];
  }

  bool get _isLastStep => _step == _activeSteps.last;

  void _next() {
    if (_step == 0 && !_validateForm()) return;

    final int currentIndex = _activeSteps.indexOf(_step);
    if (currentIndex < _activeSteps.length - 1) {
      setState(() => _step = _activeSteps[currentIndex + 1]);
    } else {
      _submit();
    }
  }

  void _back() {
    final int currentIndex = _activeSteps.indexOf(_step);
    if (currentIndex > 0) {
      setState(() => _step = _activeSteps[currentIndex - 1]);
    } else {
      context.pop();
    }
  }

  bool _validateForm() {
    final FormSchema? schema = _schema;
    if (schema == null) return false;

    // Identical rules to the server's shared validator.
    final Map<String, String> errors =
        FormValidator.validateAll(schema.fields, _answers);
    setState(() => _errors = errors);

    if (errors.isNotEmpty) {
      showErrorSnack(context, 'Please correct the highlighted fields');
      return false;
    }
    return true;
  }

  Future<Map<String, String>?> _pickFile(FormFieldSchema field) async {
    try {
      final FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: field.acceptedMimeTypes.isEmpty ? FileType.any : FileType.custom,
        allowedExtensions: field.acceptedMimeTypes.isEmpty
            ? null
            : field.acceptedMimeTypes
                .map((String m) => m.split('/').last)
                .toList(),
      );
      final String? path = result?.files.single.path;
      if (path == null) return null;

      final File file = File(path);
      final int sizeBytes = await file.length();
      final int maxBytes = field.maxFileSizeMb * 1024 * 1024;
      if (sizeBytes > maxBytes) {
        if (mounted) {
          showErrorSnack(
            context,
            '${field.label} must be smaller than ${field.maxFileSizeMb} MB',
          );
        }
        return null;
      }

      setState(() => _uploading = true);
      final String fileName = result!.files.single.name;
      final String mediaId = await widget.uploads.uploadFile(
        file: file,
        mimeType: _guessMime(fileName),
        kind: MediaKind.document,
        purpose: 'SUBMISSION_ATTACHMENT',
      );
      if (!mounted) return null;
      setState(() => _uploading = false);
      return <String, String>{'mediaId': mediaId, 'fileName': fileName};
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _uploading = false);
        showErrorSnack(context, error.message);
      }
      return null;
    }
  }

  String _guessMime(String fileName) {
    final String ext = fileName.split('.').last.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  Future<void> _submit() async {
    final FormSchema? schema = _schema;
    if (schema == null) return;
    if (!_validateForm()) {
      setState(() => _step = 0);
      return;
    }
    if (schema.requiresContract && !_contractAccepted) {
      showErrorSnack(context, 'You must accept the terms to continue');
      return;
    }

    setState(() => _submitting = true);
    try {
      await widget.repository.submitForm(
        formId: widget.formId,
        data: FormValidator.sanitizeAll(schema.fields, _answers),
        courseId: widget.courseId,
        slotId: _selectedSlotId,
        contractAccepted: schema.requiresContract ? _contractAccepted : null,
      );
      if (!mounted) return;
      setState(() => _submitting = false);
      await _showSuccess();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      showErrorSnack(context, error.message);
    }
  }

  Future<void> _showSuccess() async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) => AlertDialog(
        icon: const Icon(Icons.check_circle_outline, size: 48),
        title: const Text('Pre-registration sent'),
        content: const Text(
          'The institute has received your application and will contact you '
          'shortly. You can track its status under "My applications".',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              context.go('/home');
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: LoadingView(message: 'Loading form…'));
    }

    final FormSchema? schema = _schema;
    if (schema == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Pre-registration')),
        body: ErrorView(message: _loadError ?? 'Form unavailable', onRetry: _load),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(schema.title),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: (_activeSteps.indexOf(_step) + 1) / _activeSteps.length,
          ),
        ),
      ),
      body: AbsorbPointer(
        absorbing: _submitting || _uploading,
        child: _buildStep(schema),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton(
                  onPressed: _submitting ? null : _back,
                  child: Text(_step == _activeSteps.first ? 'Cancel' : 'Back'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _submitting ? null : _next,
                  child: _submitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(_isLastStep ? 'Submit application' : 'Continue'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStep(FormSchema schema) {
    switch (_step) {
      case 1:
        return _buildSlotStep();
      case 2:
        return _buildContractStep(schema);
      default:
        return _buildFormStep(schema);
    }
  }

  Widget _buildFormStep(FormSchema schema) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        if (schema.description != null) ...<Widget>[
          Text(schema.description!),
          const SizedBox(height: 20),
        ],
        if (_uploading)
          const Padding(
            padding: EdgeInsets.only(bottom: 16),
            child: LinearProgressIndicator(),
          ),
        ...schema.fields.map(
          (FormFieldSchema field) => DynamicFieldWidget(
            field: field,
            value: _answers[field.key],
            error: _errors[field.key],
            onPickFile: _pickFile,
            onChanged: (dynamic value) {
              setState(() {
                _answers[field.key] = value;
                // Clear the error as soon as the user edits the field.
                _errors.remove(field.key);
              });
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSlotStep() {
    final DateFormat dayFormat = DateFormat('EEE d MMM');
    final DateFormat timeFormat = DateFormat('HH:mm');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Text(
          'Choose an assessment time',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          'Pick a slot for your level assessment or interview. This step is '
          'optional — you can skip it and arrange a time later.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
        ..._slots.map((TimeSlot slot) {
          final bool selected = _selectedSlotId == slot.id;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Card(
              color: selected
                  ? Theme.of(context).colorScheme.primaryContainer
                  : null,
              child: ListTile(
                enabled: !slot.isFull,
                onTap: slot.isFull
                    ? null
                    : () => setState(
                          () => _selectedSlotId = selected ? null : slot.id,
                        ),
                leading: Icon(
                  selected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                ),
                title: Text(
                  '${dayFormat.format(slot.startsAt)} · '
                  '${timeFormat.format(slot.startsAt)}–'
                  '${timeFormat.format(slot.endsAt)}',
                ),
                subtitle: Text(
                  slot.isFull
                      ? 'Fully booked'
                      : <String>[
                          if (slot.location != null) slot.location!,
                          '${slot.seatsLeft} place(s) left',
                        ].join(' · '),
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildContractStep(FormSchema schema) {
    final ThemeData theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Text(
          'Terms and conditions',
          style:
              theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Text(
            schema.contractText ?? 'No terms were provided by the institute.',
            style: theme.textTheme.bodySmall,
          ),
        ),
        const SizedBox(height: 16),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _contractAccepted,
          onChanged: (bool? v) =>
              setState(() => _contractAccepted = v ?? false),
          title: const Text('I have read and accept the terms'),
          subtitle: Text(
            'Your acceptance is recorded with a timestamp and your IP address, '
            'and confirmed by SMS.',
            style: theme.textTheme.bodySmall,
          ),
        ),
      ],
    );
  }
}
