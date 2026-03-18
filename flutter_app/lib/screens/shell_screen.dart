import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/theme/theme_provider.dart';
import 'package:efiling_app/core/widgets/breadcrumb_nav.dart';
import 'package:efiling_app/core/widgets/user_avatar.dart';
import 'package:efiling_app/core/widgets/quick_actions_sheet.dart';
import 'package:efiling_app/core/widgets/onboarding_overlay.dart';
import 'package:curved_labeled_navigation_bar/curved_navigation_bar.dart';
import 'package:curved_labeled_navigation_bar/curved_navigation_bar_item.dart';

/// Shell with drawer and Instagram-style bottom nav: Inbox, Chat, + (center), Track, Search.
class ShellScreen extends StatelessWidget {
  const ShellScreen({super.key, required this.child, this.currentPath = '/dashboard'});

  final Widget child;
  final String currentPath;

  int _bottomNavIndex(String path) {
    if (path == '/dashboard') return 0;
    if (path.startsWith('/files/inbox') || path == '/files') return 1;
    if (path.startsWith('/chat')) return 2;
    if (path.startsWith('/files/track')) return 3;
    if (path == '/search') return 4;
    return -1;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    if (user == null) {
      return child;
    }

    final primaryRole = user.primaryRole;
    final nav = _navigationForRole(primaryRole);
    final theme = Theme.of(context);
    final selectedIndex = _bottomNavIndex(currentPath);

    return OnboardingOverlay(
      child: Semantics(
      label: 'EFMP. Current screen: ${currentPath == '/dashboard' ? 'Dashboard' : currentPath.split('/').last}',
      child: Scaffold(
      appBar: AppBar(
        title: GestureDetector(
          onLongPress: () => showQuickActionsSheet(context),
          child: const Text('EFMP'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'New file',
            onPressed: () => context.push('/files/new'),
          ),
          _PointsChip(userId: user.id),
          IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () => context.push('/notifications'), tooltip: 'Notifications'),
          IconButton(icon: const Icon(Icons.help_outline), onPressed: () => context.push('/help'), tooltip: 'Help'),
          PopupMenuButton<String>(
            icon: UserAvatar(userId: user.id, name: user.name),
            onSelected: (value) {
              if (value == 'profile') {
                context.push('/profile');
              } else if (value == 'settings') {
                context.push('/settings');
              } else if (value == 'logout') {
                auth.logout();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(value: 'profile', child: ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.person), title: Text(user.name))),
              const PopupMenuItem(value: 'settings', child: ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.settings), title: Text('Settings'))),
              const PopupMenuItem(value: 'logout', child: ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.logout), title: Text('Logout'))),
            ],
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.asset('assets/logo.png', width: 28, height: 28, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.description, size: 28)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text('EFMP', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                ],
              ),
            ),
            const Divider(height: 1),
            ...nav.map((group) => ExpansionTile(
                  initiallyExpanded: true,
                  title: Text(group.title.toUpperCase(), style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  children: group.items.map((item) => _NavItem(item: item)).toList(),
                )),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            BreadcrumbNav(path: currentPath),
            Expanded(child: child),
          ],
        ),
      ),
      bottomNavigationBar: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) {
          final theme = Theme.of(context);
          final isDark = themeProvider.themeMode == ThemeMode.dark ||
              (themeProvider.themeMode == ThemeMode.system && MediaQuery.platformBrightnessOf(context) == Brightness.dark);
          final barColor = isDark ? Colors.white : Colors.black;
          final iconLabelColor = isDark ? Colors.black : Colors.white;
          // Match the curve (dip behind selected icon) to the scaffold so it blends with the surface above
          final curveColor = theme.scaffoldBackgroundColor;
          return SafeArea(
            top: false,
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              decoration: BoxDecoration(
                color: barColor,
                borderRadius: BorderRadius.circular(28),
                // No upward shadow so the curve behind the selected icon matches the surface above
              ),
              child: ClipPath(
                clipper: _NavBarClipper(radius: 28, topExtension: 44),
                child: CurvedNavigationBar(
                  index: selectedIndex >= 0 ? selectedIndex : 0,
                  backgroundColor: curveColor,
                  color: barColor,
                  buttonBackgroundColor: barColor,
                  animationCurve: Curves.easeInOut,
                  animationDuration: const Duration(milliseconds: 300),
                  items: [
                    CurvedNavigationBarItem(
                      child: Icon(selectedIndex == 0 ? Icons.dashboard : Icons.dashboard_outlined, color: iconLabelColor, size: 26),
                      label: 'Home',
                      labelStyle: TextStyle(color: iconLabelColor, fontSize: 12, fontWeight: selectedIndex == 0 ? FontWeight.w600 : FontWeight.w500),
                    ),
                    CurvedNavigationBarItem(
                      child: Icon(selectedIndex == 1 ? Icons.inbox : Icons.inbox_outlined, color: iconLabelColor, size: 26),
                      label: 'Inbox',
                      labelStyle: TextStyle(color: iconLabelColor, fontSize: 12, fontWeight: selectedIndex == 1 ? FontWeight.w600 : FontWeight.w500),
                    ),
                    CurvedNavigationBarItem(
                      child: Icon(selectedIndex == 2 ? Icons.chat_bubble : Icons.chat_bubble_outline, color: iconLabelColor, size: 26),
                      label: 'Chat',
                      labelStyle: TextStyle(color: iconLabelColor, fontSize: 12, fontWeight: selectedIndex == 2 ? FontWeight.w600 : FontWeight.w500),
                    ),
                    CurvedNavigationBarItem(
                      child: Icon(selectedIndex == 3 ? Icons.pin_drop : Icons.pin_drop_outlined, color: iconLabelColor, size: 26),
                      label: 'Track',
                      labelStyle: TextStyle(color: iconLabelColor, fontSize: 12, fontWeight: selectedIndex == 3 ? FontWeight.w600 : FontWeight.w500),
                    ),
                    CurvedNavigationBarItem(
                      child: Icon(Icons.search, color: iconLabelColor, size: 26),
                      label: 'Search',
                      labelStyle: TextStyle(color: iconLabelColor, fontSize: 12, fontWeight: selectedIndex == 4 ? FontWeight.w600 : FontWeight.w500),
                    ),
                  ],
                  onTap: (index) {
                    switch (index) {
                      case 0: context.go('/dashboard'); break;
                      case 1: context.go('/files/inbox'); break;
                      case 2: context.go('/chat'); break;
                      case 3: context.go('/files/track'); break;
                      case 4: context.push('/search'); break;
                    }
                  },
                ),
              ),
            ),
          );
        },
      ),
    ),
    ),
    );
  }

  List<_NavGroup> _navigationForRole(String role) {
    switch (role) {
      case 'SUPER_ADMIN':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard),
            _NavItemData('New File', '/files/new', Icons.add_box),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox),
            _NavItemData('Track File', '/files/track', Icons.pin_drop),
          ]),
          _NavGroup(title: 'Admin', items: [
            _NavItemData('Active Desk', '/admin/desk', Icons.monitor),
            _NavItemData('Desk Capacity', '/admin/desks', Icons.desktop_windows),
            _NavItemData('Capacity Management', '/admin/capacity', Icons.tune),
            _NavItemData('Features', '/admin/features', Icons.settings_suggest),
            _NavItemData('Documents', '/admin/documents', Icons.folder_special),
            _NavItemData('Recall Protocol', '/admin/recall', Icons.warning_amber),
            _NavItemData('Workflows', '/admin/workflows', Icons.account_tree),
            _NavItemData('Users', '/admin/users', Icons.people),
            _NavItemData('Departments', '/admin/departments', Icons.apartment),
            _NavItemData('Analytics', '/admin/analytics', Icons.bar_chart),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book),
            _NavItemData('My tickets', '/support', Icons.support_agent),
            _NavItemData('Chat', '/chat', Icons.chat_bubble_outline),
            _NavItemData('Settings', '/settings', Icons.settings),
          ]),
        ];
      case 'DEPT_ADMIN':
      case 'INWARD_DESK':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard),
            _NavItemData('New File', '/files/new', Icons.add_box),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox),
            _NavItemData('Track File', '/files/track', Icons.pin_drop),
          ]),
          _NavGroup(title: 'Admin', items: [
            _NavItemData('Active Desk', '/admin/desk', Icons.monitor),
            _NavItemData('Desk Capacity', '/admin/desks', Icons.desktop_windows),
            _NavItemData('Capacity Management', '/admin/capacity', Icons.tune),
            _NavItemData('Documents', '/admin/documents', Icons.folder_special),
            _NavItemData('Workflows', '/admin/workflows', Icons.account_tree),
            _NavItemData('Users', '/admin/users', Icons.people),
            _NavItemData('Departments', '/admin/departments', Icons.apartment),
            _NavItemData('Analytics', '/admin/analytics', Icons.bar_chart),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book),
            _NavItemData('My tickets', '/support', Icons.support_agent),
            _NavItemData('Chat', '/chat', Icons.chat_bubble_outline),
            _NavItemData('Settings', '/settings', Icons.settings),
          ]),
        ];
      case 'CHAT_MANAGER':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard),
            _NavItemData('My Files', '/files', Icons.folder),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox),
            _NavItemData('Track File', '/files/track', Icons.pin_drop),
            _NavItemData('Opinion Inbox', '/opinions/inbox', Icons.message),
          ]),
          _NavGroup(title: 'Chat Admin', items: [
            _NavItemData('Manage Groups', '/chat', Icons.group),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book),
            _NavItemData('My tickets', '/support', Icons.support_agent),
            _NavItemData('Chat', '/chat', Icons.chat_bubble_outline),
            _NavItemData('Settings', '/settings', Icons.settings),
          ]),
        ];
      case 'SECTION_OFFICER':
      case 'USER':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard),
            _NavItemData('My Files', '/files', Icons.folder),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox),
            _NavItemData('Track File', '/files/track', Icons.pin_drop),
            _NavItemData('Opinion Inbox', '/opinions/inbox', Icons.message),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book),
            _NavItemData('My tickets', '/support', Icons.support_agent),
            _NavItemData('Chat', '/chat', Icons.chat_bubble_outline),
            _NavItemData('Settings', '/settings', Icons.settings),
          ]),
        ];
      case 'APPROVAL_AUTHORITY':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard),
            _NavItemData('My Files', '/files', Icons.folder),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox),
            _NavItemData('Pending Approvals', '/files/approvals', Icons.pending_actions),
            _NavItemData('Track File', '/files/track', Icons.pin_drop),
            _NavItemData('Opinion Inbox', '/opinions/inbox', Icons.message),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book),
            _NavItemData('My tickets', '/support', Icons.support_agent),
            _NavItemData('Chat', '/chat', Icons.chat_bubble_outline),
            _NavItemData('Settings', '/settings', Icons.settings),
          ]),
        ];
      case 'DISPATCHER':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard),
            _NavItemData('Ready for Dispatch', '/dispatch', Icons.send),
            _NavItemData('Dispatch History', '/dispatch/history', Icons.history),
            _NavItemData('Track File', '/files/track', Icons.pin_drop),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book),
            _NavItemData('My tickets', '/support', Icons.support_agent),
            _NavItemData('Chat', '/chat', Icons.chat_bubble_outline),
            _NavItemData('Settings', '/settings', Icons.settings),
          ]),
        ];
      default:
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard),
            _NavItemData('My Files', '/files', Icons.folder),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox),
            _NavItemData('Track File', '/files/track', Icons.pin_drop),
            _NavItemData('Opinion Inbox', '/opinions/inbox', Icons.message),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book),
            _NavItemData('My tickets', '/support', Icons.support_agent),
            _NavItemData('Chat', '/chat', Icons.chat_bubble_outline),
            _NavItemData('Settings', '/settings', Icons.settings),
          ]),
        ];
    }
  }
}

class _PointsChip extends StatefulWidget {
  final String userId;

  const _PointsChip({required this.userId});

  @override
  State<_PointsChip> createState() => _PointsChipState();
}

class _PointsChipState extends State<_PointsChip> {
  int? _points;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiClient().get<dynamic>('/gamification/points/${widget.userId}');
      final data = res.data;
      if (data is Map && data['currentPoints'] != null && mounted) {
        setState(() => _points = (data['currentPoints'] as num).toInt());
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_points == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 64),
          child: ActionChip(
            avatar: const Icon(Icons.stars, size: 18, color: Colors.amber),
            label: Text('$_points', overflow: TextOverflow.visible),
            onPressed: () => context.push('/profile'),
          ),
        ),
      ),
    );
  }
}

/// Clips with rounded bottom corners and extends the top upward so the
/// curved bar's floating selected icon is not cut off.
class _NavBarClipper extends CustomClipper<Path> {
  _NavBarClipper({this.radius = 28, this.topExtension = 44});
  final double radius;
  final double topExtension;

  @override
  Path getClip(Size size) {
    final r = math.min(radius, math.min(size.height / 2, size.width / 2));
    final top = -topExtension;
    return Path()
      ..moveTo(0, top)
      ..lineTo(size.width, top)
      ..lineTo(size.width, size.height - r)
      ..arcToPoint(Offset(size.width - r, size.height), radius: Radius.circular(r))
      ..lineTo(r, size.height)
      ..arcToPoint(Offset(0, size.height - r), radius: Radius.circular(r))
      ..lineTo(0, top)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) =>
      oldClipper is _NavBarClipper &&
      (oldClipper.radius != radius || oldClipper.topExtension != topExtension);
}

class _NavGroup {
  final String title;
  final List<_NavItemData> items;
  _NavGroup({required this.title, required this.items});
}

class _NavItemData {
  final String name;
  final String path;
  final IconData icon;
  _NavItemData(this.name, this.path, this.icon);
}

class _NavItem extends StatelessWidget {
  final _NavItemData item;

  const _NavItem({required this.item});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(item.icon, size: 20),
      title: Text(item.name),
      onTap: () {
        Navigator.of(context).pop();
        context.go(item.path);
      },
    );
  }
}

