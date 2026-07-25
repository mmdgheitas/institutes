import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/map/marker_cluster.dart';
import '../../core/theme/app_theme.dart';
import '../../data/models/institute.dart';
import 'common.dart';

/// Formats a price in the platform currency (toman-style grouping).
String formatPrice(double? amount, {String currency = 'IRR'}) {
  if (amount == null || amount <= 0) return 'Free';
  final NumberFormat formatter = NumberFormat.decimalPattern('en');
  return '${formatter.format(amount.round())} $currency';
}

/// Vertical list card used by the list view and search results.
class InstituteListCard extends StatelessWidget {
  const InstituteListCard({
    super.key,
    required this.card,
    required this.onTap,
  });

  final InstituteCard card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final MapPin pin = card.pin;

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              AppNetworkImage(
                url: pin.coverImageUrl,
                width: 92,
                height: 92,
                borderRadius: BorderRadius.circular(12),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            pin.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        if (pin.isVerified) const VerifiedBadge(size: 17),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: <Widget>[
                        RatingStars(
                          rating: pin.rating,
                          reviewCount: pin.reviewCount,
                        ),
                        if (pin.distanceMeters != null) ...<Widget>[
                          const SizedBox(width: 8),
                          Icon(
                            Icons.place_outlined,
                            size: 13,
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                          Text(
                            formatDistance(pin.distanceMeters!),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      card.shortDescription ?? card.address,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: <Widget>[
                        if (pin.hasOnlineCourses)
                          const TagChip(
                            label: 'Online',
                            icon: Icons.videocam_outlined,
                            color: AppTheme.secondary,
                            dense: true,
                          ),
                        if (pin.hasActiveDiscount)
                          const TagChip(
                            label: 'Discount',
                            icon: Icons.local_offer_outlined,
                            color: AppTheme.danger,
                            dense: true,
                          ),
                        if (pin.freePreRegistration)
                          const TagChip(
                            label: 'Free sign-up',
                            color: AppTheme.success,
                            dense: true,
                          ),
                        if (card.courseCount > 0)
                          TagChip(
                            label: '${card.courseCount} courses',
                            color: theme.colorScheme.outline,
                            dense: true,
                          ),
                      ],
                    ),
                    if (pin.minPrice != null) ...<Widget>[
                      const SizedBox(height: 6),
                      Text(
                        'From ${formatPrice(pin.minPrice)}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact card shown in the bottom sheet when a map pin is tapped.
class InstitutePreviewCard extends StatelessWidget {
  const InstitutePreviewCard({
    super.key,
    required this.pin,
    required this.onTap,
    required this.onClose,
  });

  final MapPin pin;
  final VoidCallback onTap;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Card(
      elevation: 8,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              AppNetworkImage(
                url: pin.coverImageUrl,
                width: 76,
                height: 76,
                borderRadius: BorderRadius.circular(12),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            pin.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        if (pin.isVerified) const VerifiedBadge(size: 16),
                        IconButton(
                          onPressed: onClose,
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          icon: const Icon(Icons.close, size: 18),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: <Widget>[
                        RatingStars(
                          rating: pin.rating,
                          reviewCount: pin.reviewCount,
                        ),
                        if (pin.distanceMeters != null) ...<Widget>[
                          const SizedBox(width: 8),
                          Text(
                            formatDistance(pin.distanceMeters!),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: <Widget>[
                        if (pin.minPrice != null)
                          Expanded(
                            child: Text(
                              'From ${formatPrice(pin.minPrice)}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                          ),
                        const Icon(Icons.arrow_forward_ios, size: 13),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
