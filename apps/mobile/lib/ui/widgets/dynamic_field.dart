import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../data/models/dynamic_form.dart';
import '../../data/models/enums.dart';

/// Renders one field of an institute's custom form.
///
/// The widget is stateless with respect to the value: the parent owns the
/// answer map, which keeps validation and submission in one place.
class DynamicFieldWidget extends StatelessWidget {
  const DynamicFieldWidget({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
    required this.onPickFile,
    this.error,
  });

  final FormFieldSchema field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;

  /// Invoked for FILE fields; returns `{mediaId, fileName}` or null.
  final Future<Map<String, String>?> Function(FormFieldSchema field) onPickFile;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _buildLabel(context),
          const SizedBox(height: 8),
          _buildInput(context),
          if (field.helpText != null && error == null) ...<Widget>[
            const SizedBox(height: 6),
            Text(
              field.helpText!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
          if (error != null) ...<Widget>[
            const SizedBox(height: 6),
            Row(
              children: <Widget>[
                Icon(
                  Icons.error_outline,
                  size: 14,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    error!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.error,
                        ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLabel(BuildContext context) {
    // Checkboxes render their own inline label.
    if (field.type == FormFieldType.checkbox) return const SizedBox.shrink();

    return RichText(
      text: TextSpan(
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(fontWeight: FontWeight.w600),
        children: <InlineSpan>[
          TextSpan(text: field.label),
          if (field.required)
            TextSpan(
              text: ' *',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      ),
    );
  }

  Widget _buildInput(BuildContext context) {
    switch (field.type) {
      case FormFieldType.text:
      case FormFieldType.email:
        return TextFormField(
          initialValue: value?.toString() ?? '',
          onChanged: onChanged,
          keyboardType: field.type == FormFieldType.email
              ? TextInputType.emailAddress
              : TextInputType.text,
          maxLength: field.maxLength,
          decoration: InputDecoration(
            hintText: field.placeholder,
            counterText: '',
            errorText: null,
          ),
        );

      case FormFieldType.textarea:
        return TextFormField(
          initialValue: value?.toString() ?? '',
          onChanged: onChanged,
          maxLines: 4,
          maxLength: field.maxLength,
          decoration: InputDecoration(hintText: field.placeholder),
        );

      case FormFieldType.number:
        return TextFormField(
          initialValue: value?.toString() ?? '',
          onChanged: (String text) =>
              onChanged(text.isEmpty ? null : num.tryParse(text) ?? text),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(hintText: field.placeholder),
        );

      case FormFieldType.phone:
        return TextFormField(
          initialValue: value?.toString() ?? '',
          onChanged: onChanged,
          keyboardType: TextInputType.phone,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.allow(RegExp(r'[\d+\s۰-۹٠-٩-]')),
          ],
          decoration: InputDecoration(
            hintText: field.placeholder ?? '09xxxxxxxxx',
            prefixIcon: const Icon(Icons.phone_outlined),
          ),
        );

      case FormFieldType.nationalId:
        return TextFormField(
          initialValue: value?.toString() ?? '',
          onChanged: onChanged,
          keyboardType: TextInputType.number,
          maxLength: 10,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.allow(RegExp(r'[\d۰-۹٠-٩]')),
          ],
          decoration: InputDecoration(
            hintText: field.placeholder ?? '10 digits',
            counterText: '',
            prefixIcon: const Icon(Icons.badge_outlined),
          ),
        );

      case FormFieldType.date:
        return _DateField(
          value: value?.toString(),
          hint: field.placeholder,
          onChanged: onChanged,
        );

      case FormFieldType.select:
        return DropdownButtonFormField<String>(
          initialValue: field.options.any(
            (FormFieldOption o) => o.value == value,
          )
              ? value as String
              : null,
          isExpanded: true,
          hint: Text(field.placeholder ?? 'Choose one'),
          items: field.options
              .map(
                (FormFieldOption option) => DropdownMenuItem<String>(
                  value: option.value,
                  child: Text(option.label, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: onChanged,
        );

      case FormFieldType.multiSelect:
        final List<String> selected =
            value is List ? List<String>.from(value.map((e) => e.toString())) : <String>[];
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: field.options.map((FormFieldOption option) {
            final bool isSelected = selected.contains(option.value);
            return FilterChip(
              label: Text(option.label),
              selected: isSelected,
              onSelected: (bool value) {
                final List<String> next = List<String>.from(selected);
                if (value) {
                  next.add(option.value);
                } else {
                  next.remove(option.value);
                }
                onChanged(next);
              },
            );
          }).toList(),
        );

      case FormFieldType.checkbox:
        return CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: value == true,
          onChanged: (bool? checked) => onChanged(checked ?? false),
          title: RichText(
            text: TextSpan(
              style: Theme.of(context).textTheme.bodyMedium,
              children: <InlineSpan>[
                TextSpan(text: field.label),
                if (field.required)
                  TextSpan(
                    text: ' *',
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
              ],
            ),
          ),
        );

      case FormFieldType.file:
        return _FileField(
          field: field,
          value: value is Map ? Map<String, dynamic>.from(value) : null,
          onPick: () async {
            final Map<String, String>? picked = await onPickFile(field);
            if (picked != null) onChanged(picked);
          },
          onClear: () => onChanged(null),
        );
    }
  }
}

class _DateField extends StatelessWidget {
  const _DateField({required this.value, required this.onChanged, this.hint});

  final String? value;
  final ValueChanged<dynamic> onChanged;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final DateTime now = DateTime.now();
        final DateTime? picked = await showDatePicker(
          context: context,
          initialDate: DateTime.tryParse(value ?? '') ?? now,
          firstDate: DateTime(now.year - 100),
          lastDate: DateTime(now.year + 10),
        );
        if (picked != null) {
          // ISO yyyy-MM-dd, exactly what the server validator expects.
          onChanged(
            '${picked.year.toString().padLeft(4, '0')}-'
            '${picked.month.toString().padLeft(2, '0')}-'
            '${picked.day.toString().padLeft(2, '0')}',
          );
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(
          suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
          hintText: hint,
        ),
        child: Text(
          value?.isNotEmpty == true ? value! : (hint ?? 'Select a date'),
          style: value?.isNotEmpty == true
              ? null
              : TextStyle(color: Theme.of(context).hintColor),
        ),
      ),
    );
  }
}

class _FileField extends StatelessWidget {
  const _FileField({
    required this.field,
    required this.value,
    required this.onPick,
    required this.onClear,
  });

  final FormFieldSchema field;
  final Map<String, dynamic>? value;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String? fileName = value?['fileName'] as String?;

    if (fileName != null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: theme.colorScheme.outlineVariant),
          color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
        ),
        child: Row(
          children: <Widget>[
            Icon(Icons.insert_drive_file_outlined,
                color: theme.colorScheme.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(fileName, overflow: TextOverflow.ellipsis),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 18),
              onPressed: onClear,
            ),
          ],
        ),
      );
    }

    return OutlinedButton.icon(
      onPressed: onPick,
      icon: const Icon(Icons.upload_file_outlined),
      label: Text(
        'Upload${field.maxFileSizeMb > 0 ? ' (max ${field.maxFileSizeMb} MB)' : ''}',
      ),
    );
  }
}
