import 'package:flutter/material.dart';

import '../../core/map/marker_cluster.dart';
import '../../core/theme/app_theme.dart';
import '../../data/models/institute.dart';

/// Maps a category slug to an icon. Keeps the map legible without shipping
/// custom artwork; the colour comes from the category record itself.
IconData iconForCategory(String slug) {
  switch (slug) {
    case 'languages':
      return Icons.translate_rounded;
    case 'programming':
      return Icons.code_rounded;
    case 'music':
      return Icons.music_note_rounded;
    case 'arts':
      return Icons.palette_outlined;
    case 'academic-tutoring':
      return Icons.menu_book_rounded;
    case 'test-prep':
      return Icons.fact_check_outlined;
    case 'business':
      return Icons.business_center_outlined;
    case 'sports':
      return Icons.sports_soccer_rounded;
    default:
      return Icons.school_rounded;
  }
}

/// A single institute pin, drawn as a teardrop with the category icon.
class InstituteMarker extends StatelessWidget {
  const InstituteMarker({
    super.key,
    required this.pin,
    required this.isSelected,
    required this.onTap,
  });

  final MapPin pin;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color color = AppTheme.parseHexColor(pin.categoryColor);
    final double scale = isSelected ? 1.25 : 1.0;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedScale(
        scale: scale,
        duration: const Duration(milliseconds: 160),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2.5),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: <Widget>[
                  Icon(
                    iconForCategory(pin.categorySlug),
                    color: Colors.white,
                    size: 19,
                  ),
                  if (pin.isVerified)
                    Positioned(
                      right: -1,
                      top: -1,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.verified_rounded,
                          size: 12,
                          color: AppTheme.verified,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // Teardrop tail pointing at the exact coordinate.
            CustomPaint(
              size: const Size(10, 6),
              painter: _MarkerTailPainter(color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class _MarkerTailPainter extends CustomPainter {
  const _MarkerTailPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final Path path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_MarkerTailPainter oldDelegate) =>
      oldDelegate.color != color;
}

/// A grouped marker showing how many institutes it contains.
class ClusterMarker extends StatelessWidget {
  const ClusterMarker({
    super.key,
    required this.cluster,
    required this.onTap,
  });

  final MapCluster cluster;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color color = AppTheme.parseHexColor(cluster.dominantColor);
    // Larger groups get a larger badge, capped so it never dominates.
    final double size = cluster.count < 10
        ? 42
        : cluster.count < 50
            ? 50
            : 58;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: color.withValues(alpha: 0.45),
              blurRadius: 12,
              spreadRadius: 2,
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Text(
          cluster.count > 999 ? '999+' : '${cluster.count}',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: size * 0.34,
          ),
        ),
      ),
    );
  }
}

/// Pulsing dot marking the user's own position.
class UserLocationMarker extends StatelessWidget {
  const UserLocationMarker({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.secondary.withValues(alpha: 0.25),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: AppTheme.secondary,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 4,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
