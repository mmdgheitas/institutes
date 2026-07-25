import 'package:flutter/material.dart';

import '../../../data/models/enums.dart';
import '../../../data/models/institute.dart';
import '../../../data/repositories/discovery_repository.dart';
import '../../widgets/map_markers.dart';

/// Bottom sheet exposing every discovery filter the API supports.
class FilterSheet extends StatefulWidget {
  const FilterSheet({
    super.key,
    required this.initial,
    required this.categories,
    required this.skills,
    required this.onApply,
    required this.onClear,
  });

  final DiscoveryFilters initial;
  final List<CategorySummary> categories;
  final List<String> skills;
  final void Function(DiscoveryFilters filters) onApply;
  final VoidCallback onClear;

  @override
  State<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<FilterSheet> {
  late List<String> _categories;
  late List<String> _skills;
  late double? _minRating;
  late bool _hasOnline;
  late bool _hasDiscount;
  late bool _freePreRegistration;
  late bool _verifiedOnly;
  late double _radiusKm;
  late DiscoverySort _sort;

  @override
  void initState() {
    super.initState();
    final DiscoveryFilters f = widget.initial;
    _categories = List<String>.from(f.categories);
    _skills = List<String>.from(f.skills);
    _minRating = f.minRating;
    _hasOnline = f.hasOnline ?? false;
    _hasDiscount = f.hasDiscount ?? false;
    _freePreRegistration = f.freePreRegistration ?? false;
    _verifiedOnly = f.verifiedOnly ?? false;
    _radiusKm = ((f.radiusMeters ?? 5000) / 1000).clamp(1, 50).toDouble();
    _sort = f.sort;
  }

  void _apply() {
    // `false` means "don't filter", so send null rather than false.
    widget.onApply(
      widget.initial.copyWith(
        categories: _categories,
        skills: _skills,
        minRating: _minRating,
        clearMinRating: _minRating == null,
        hasOnline: _hasOnline ? true : null,
        hasDiscount: _hasDiscount ? true : null,
        freePreRegistration: _freePreRegistration ? true : null,
        verifiedOnly: _verifiedOnly ? true : null,
        radiusMeters: (_radiusKm * 1000).round(),
        sort: _sort,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return DraggableScrollableSheet(
      initialChildSize: 0.78,
      minChildSize: 0.45,
      maxChildSize: 0.95,
      expand: false,
      builder: (BuildContext context, ScrollController controller) {
        return Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 4),
              child: Row(
                children: <Widget>[
                  Text('Filters', style: theme.textTheme.titleLarge),
                  const Spacer(),
                  TextButton(
                    onPressed: () {
                      widget.onClear();
                      Navigator.of(context).pop();
                    },
                    child: const Text('Clear all'),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                children: <Widget>[
                  _sectionTitle('Sort by'),
                  Wrap(
                    spacing: 8,
                    children: DiscoverySort.values.map((DiscoverySort sort) {
                      return ChoiceChip(
                        label: Text(sort.label),
                        selected: _sort == sort,
                        onSelected: (_) => setState(() => _sort = sort),
                      );
                    }).toList(),
                  ),

                  _sectionTitle('Categories'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: widget.categories.map((CategorySummary c) {
                      final bool selected = _categories.contains(c.slug);
                      return FilterChip(
                        avatar: Icon(iconForCategory(c.slug), size: 17),
                        label: Text(
                          c.instituteCount != null
                              ? '${c.name} (${c.instituteCount})'
                              : c.name,
                        ),
                        selected: selected,
                        onSelected: (bool value) => setState(() {
                          if (value) {
                            _categories.add(c.slug);
                          } else {
                            _categories.remove(c.slug);
                          }
                        }),
                      );
                    }).toList(),
                  ),

                  if (widget.skills.isNotEmpty) ...<Widget>[
                    _sectionTitle('Skills'),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: widget.skills.take(24).map((String skill) {
                        final bool selected = _skills.contains(skill);
                        return FilterChip(
                          label: Text(skill),
                          selected: selected,
                          onSelected: (bool value) => setState(() {
                            if (value) {
                              _skills.add(skill);
                            } else {
                              _skills.remove(skill);
                            }
                          }),
                        );
                      }).toList(),
                    ),
                  ],

                  _sectionTitle('Minimum rating'),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: SegmentedButton<double?>(
                          showSelectedIcon: false,
                          segments: const <ButtonSegment<double?>>[
                            ButtonSegment<double?>(
                              value: null,
                              label: Text('Any'),
                            ),
                            ButtonSegment<double?>(
                              value: 3.5,
                              label: Text('3.5+'),
                            ),
                            ButtonSegment<double?>(
                              value: 4.0,
                              label: Text('4.0+'),
                            ),
                            ButtonSegment<double?>(
                              value: 4.5,
                              label: Text('4.5+'),
                            ),
                          ],
                          selected: <double?>{_minRating},
                          onSelectionChanged: (Set<double?> selection) =>
                              setState(() => _minRating = selection.first),
                        ),
                      ),
                    ],
                  ),

                  _sectionTitle('Search radius'),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Slider(
                          value: _radiusKm,
                          min: 1,
                          max: 50,
                          divisions: 49,
                          label: '${_radiusKm.round()} km',
                          onChanged: (double value) =>
                              setState(() => _radiusKm = value),
                        ),
                      ),
                      SizedBox(
                        width: 56,
                        child: Text(
                          '${_radiusKm.round()} km',
                          textAlign: TextAlign.end,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),

                  _sectionTitle('Options'),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Has online classes'),
                    subtitle: const Text('Institutes offering remote courses'),
                    value: _hasOnline,
                    onChanged: (bool v) => setState(() => _hasOnline = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Active discount'),
                    subtitle: const Text('Courses currently on offer'),
                    value: _hasDiscount,
                    onChanged: (bool v) => setState(() => _hasDiscount = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Free pre-registration'),
                    value: _freePreRegistration,
                    onChanged: (bool v) =>
                        setState(() => _freePreRegistration = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Verified only'),
                    subtitle: const Text('Government-licensed institutes'),
                    value: _verifiedOnly,
                    onChanged: (bool v) => setState(() => _verifiedOnly = v),
                  ),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: FilledButton(
                  onPressed: _apply,
                  child: const Text('Show results'),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _sectionTitle(String text) => Padding(
        padding: const EdgeInsets.only(top: 20, bottom: 10),
        child: Text(
          text,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
      );
}
