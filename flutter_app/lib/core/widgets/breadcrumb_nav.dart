import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';

/// Breadcrumb from current path using [FBreadcrumb] ([Forui](https://forui.dev/)).
class BreadcrumbNav extends StatelessWidget {
  const BreadcrumbNav({super.key, required this.path, this.labelOverrides});

  final String path;
  final Map<String, String>? labelOverrides;

  static String _segmentToLabel(String segment) {
    if (segment.isEmpty) return segment;
    final overrides = _defaultLabels;
    final lower = segment.toLowerCase();
    if (overrides.containsKey(lower)) return overrides[lower]!;
    if (segment.length > 20 && (segment.contains('-') || RegExp(r'^[a-f0-9-]+$').hasMatch(segment))) {
      return 'Detail';
    }
    return segment.split('-').map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase()).join(' ');
  }

  static const Map<String, String> _defaultLabels = {
    'files': 'Files',
    'inbox': 'Inbox',
    'new': 'New File',
    'track': 'Track Files',
    'approvals': 'Approvals',
    'admin': 'Admin',
    'users': 'Users',
    'desk': 'Active Desk',
    'desks': 'Desk Capacity',
    'documents': 'Documents',
    'recall': 'Recall',
    'workflows': 'Workflows',
    'analytics': 'Analytics',
    'dispatch': 'Dispatch',
    'history': 'History',
    'chat': 'Chat',
    'opinions': 'Opinions',
    'dashboard': 'Dashboard',
    'profile': 'Profile',
    'settings': 'Settings',
    'builder': 'Workflow Builder',
  };

  @override
  Widget build(BuildContext context) {
    if (path == '/login' || path == '/' || path.isEmpty) return const SizedBox.shrink();

    final segments = path.split('/').where((s) => s.isNotEmpty).toList();
    if (segments.isEmpty) return const SizedBox.shrink();

    final overrides = labelOverrides ?? {};

    String labelFor(String segment) {
      final lower = segment.toLowerCase();
      return overrides[lower] ?? _segmentToLabel(segment);
    }

    final items = <Widget>[
      FBreadcrumbItem(
        onPress: () => context.go('/dashboard'),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(FIcons.house, size: 16, color: context.theme.colors.mutedForeground),
            const SizedBox(width: 6),
            const Text('Home'),
          ],
        ),
      ),
    ];

    for (var i = 0; i < segments.length; i++) {
      final segment = segments[i];
      final href = '/${segments.sublist(0, i + 1).join('/')}';
      final isLast = i == segments.length - 1;
      final label = labelFor(segment);

      if (isLast) {
        items.add(FBreadcrumbItem(current: true, child: Text(label)));
      } else {
        items.add(
          FBreadcrumbItem(
            onPress: () => context.go(href),
            child: Text(label),
          ),
        );
      }
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
        child: FBreadcrumb(children: items),
      ),
    );
  }
}
