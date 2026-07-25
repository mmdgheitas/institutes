import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Bottom-navigation shell hosting the four primary tabs.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.child, required this.location});

  final Widget child;
  final String location;

  static const List<String> _routes = <String>[
    '/home',
    '/my-courses',
    '/applications',
    '/profile',
  ];

  int get _currentIndex {
    final int index =
        _routes.indexWhere((String route) => location.startsWith(route));
    return index < 0 ? 0 : index;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (int index) => context.go(_routes[index]),
        destinations: const <NavigationDestination>[
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'Discover',
          ),
          NavigationDestination(
            icon: Icon(Icons.school_outlined),
            selectedIcon: Icon(Icons.school),
            label: 'My courses',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment),
            label: 'Applications',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
