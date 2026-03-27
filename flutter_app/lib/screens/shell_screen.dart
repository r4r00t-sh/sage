import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/utils/responsive.dart';
import 'package:efiling_app/core/widgets/breadcrumb_nav.dart';
import 'package:efiling_app/core/widgets/user_avatar.dart';
import 'package:efiling_app/core/widgets/quick_actions_sheet.dart';
import 'package:efiling_app/core/widgets/onboarding_overlay.dart';

/// Shell with [FScaffold]: tablet/desktop persistent [FSidebar], phone drawer + [FBottomNavigationBar].
/// Uses [Forui](https://forui.dev/) for layout, density, and motion.
class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key, required this.child, this.currentPath = '/dashboard'});

  final Widget child;
  final String currentPath;

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  int _bottomNavIndex(String path) {
    if (path == '/dashboard') return 0;
    if (path.startsWith('/files/inbox') || path == '/files') return 1;
    if (path.startsWith('/files/track')) return 2;
    if (path == '/search') return 3;
    return -1;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    if (user == null) {
      return widget.child;
    }

    final primaryRole = user.primaryRole;
    final nav = _navigationForRole(primaryRole);
    final selectedIndex = _bottomNavIndex(widget.currentPath);
    final wide = Responsive.isWide(context);

    final shellBody = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BreadcrumbNav(path: widget.currentPath),
        Expanded(
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: Responsive.contentMaxWidth(context)),
              child: widget.child,
            ),
          ),
        ),
      ],
    );

    final header = FHeader(
      title: GestureDetector(
        onLongPress: () => showQuickActionsSheet(context),
        child: Row(
          children: [
            if (!wide)
              FHeaderAction(
                icon: const Icon(Icons.menu_rounded),
                onPress: () => _scaffoldKey.currentState?.openDrawer(),
              ),
            Expanded(
              child: Text(
                'EFMP',
                style: context.theme.typography.xl2.copyWith(
                  fontWeight: FontWeight.w700,
                  color: context.theme.colors.foreground,
                ),
              ),
            ),
          ],
        ),
      ),
      suffixes: [
        FHeaderAction(
          icon: const Icon(FIcons.plus),
          onPress: () => context.push('/files/new'),
        ),
        _PointsHeaderAction(userId: user.id),
        FHeaderAction(
          icon: const Icon(FIcons.bell),
          onPress: () => context.push('/notifications'),
        ),
        FHeaderAction(
          icon: const Icon(FIcons.circleQuestionMark),
          onPress: () => context.push('/help'),
        ),
        PopupMenuButton<String>(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: UserAvatar(userId: user.id, name: user.name),
          ),
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
            PopupMenuItem(
              value: 'profile',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.person_outline),
                title: Text(user.name),
              ),
            ),
            const PopupMenuItem(
              value: 'settings',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.settings_outlined),
                title: Text('Settings'),
              ),
            ),
            const PopupMenuItem(
              value: 'logout',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.logout),
                title: Text('Logout'),
              ),
            ),
          ],
        ),
      ],
    );

    final bottomNav = FBottomNavigationBar(
      index: selectedIndex >= 0 ? selectedIndex : 0,
      safeAreaBottom: true,
      onChange: (index) {
        switch (index) {
          case 0:
            context.go('/dashboard');
            break;
          case 1:
            context.go('/files/inbox');
            break;
          case 2:
            context.go('/files/track');
            break;
          case 3:
            context.push('/search');
            break;
        }
      },
      children: const [
        FBottomNavigationBarItem(
          icon: Icon(FIcons.layoutDashboard),
          label: Text('Home'),
        ),
        FBottomNavigationBarItem(
          icon: Icon(FIcons.inbox),
          label: Text('Inbox'),
        ),
        FBottomNavigationBarItem(
          icon: Icon(FIcons.mapPin),
          label: Text('Track'),
        ),
        FBottomNavigationBarItem(
          icon: Icon(FIcons.search),
          label: Text('Search'),
        ),
      ],
    );

    final sidebar = _buildSidebar(context, nav);

    return OnboardingOverlay(
      child: Semantics(
        label: 'EFMP. Current screen: ${widget.currentPath == '/dashboard' ? 'Dashboard' : widget.currentPath.split('/').last}',
        child: Scaffold(
          key: _scaffoldKey,
          drawer: wide
              ? null
              : Drawer(
                  child: SafeArea(
                    child: sidebar,
                  ),
                ),
          body: FScaffold(
            header: header,
            sidebar: wide ? sidebar : null,
            footer: wide ? null : bottomNav,
            child: shellBody,
          ),
        ),
      ),
    );
  }

  Widget _buildSidebar(BuildContext context, List<_NavGroup> groups) {
    return FSidebar(
      header: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                'assets/logo.png',
                width: 32,
                height: 32,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Icon(FIcons.fileText, size: 28, color: context.theme.colors.foreground),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'EFMP',
              style: context.theme.typography.sm.copyWith(
                fontWeight: FontWeight.w700,
                color: context.theme.colors.foreground,
              ),
            ),
          ],
        ),
      ),
      children: [
        for (final group in groups)
          FSidebarGroup(
            label: Text(group.title.toUpperCase()),
            children: [
              for (final item in group.items)
                FSidebarItem(
                  icon: Icon(item.icon, size: 20),
                  label: Text(item.name),
                  selected: widget.currentPath == item.path || widget.currentPath.startsWith('${item.path}/'),
                  onPress: () {
                    Navigator.of(context).maybePop();
                    context.go(item.path);
                  },
                ),
            ],
          ),
      ],
    );
  }

  List<_NavGroup> _navigationForRole(String role) {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'DEVELOPER':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard_outlined),
            _NavItemData('New File', '/files/new', Icons.add_box_outlined),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox_outlined),
            _NavItemData('Track File', '/files/track', Icons.pin_drop_outlined),
          ]),
          _NavGroup(title: 'Admin', items: [
            _NavItemData('Active Desk', '/admin/desk', Icons.monitor_outlined),
            _NavItemData('Desk Capacity', '/admin/desks', Icons.desktop_windows_outlined),
            _NavItemData('Capacity Management', '/admin/capacity', Icons.tune),
            _NavItemData('Features', '/admin/features', Icons.settings_suggest_outlined),
            _NavItemData('Documents', '/admin/documents', Icons.folder_special_outlined),
            _NavItemData('Recall Protocol', '/admin/recall', Icons.warning_amber_outlined),
            _NavItemData('Workflows', '/admin/workflows', Icons.account_tree_outlined),
            _NavItemData('Users', '/admin/users', Icons.people_outline),
            _NavItemData('Departments', '/admin/departments', Icons.apartment_outlined),
            _NavItemData('Analytics', '/admin/analytics', Icons.bar_chart_outlined),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book_outlined),
            _NavItemData('My tickets', '/support', Icons.support_agent_outlined),
            _NavItemData('Settings', '/settings', Icons.settings_outlined),
          ]),
        ];
      case 'DEPT_ADMIN':
      case 'INWARD_DESK':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard_outlined),
            _NavItemData('New File', '/files/new', Icons.add_box_outlined),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox_outlined),
            _NavItemData('Track File', '/files/track', Icons.pin_drop_outlined),
          ]),
          _NavGroup(title: 'Admin', items: [
            _NavItemData('Active Desk', '/admin/desk', Icons.monitor_outlined),
            _NavItemData('Desk Capacity', '/admin/desks', Icons.desktop_windows_outlined),
            _NavItemData('Capacity Management', '/admin/capacity', Icons.tune),
            _NavItemData('Documents', '/admin/documents', Icons.folder_special_outlined),
            _NavItemData('Workflows', '/admin/workflows', Icons.account_tree_outlined),
            _NavItemData('Users', '/admin/users', Icons.people_outline),
            _NavItemData('Departments', '/admin/departments', Icons.apartment_outlined),
            _NavItemData('Analytics', '/admin/analytics', Icons.bar_chart_outlined),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book_outlined),
            _NavItemData('My tickets', '/support', Icons.support_agent_outlined),
            _NavItemData('Settings', '/settings', Icons.settings_outlined),
          ]),
        ];
      case 'CHAT_MANAGER':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard_outlined),
            _NavItemData('My Files', '/files', Icons.folder_outlined),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox_outlined),
            _NavItemData('Track File', '/files/track', Icons.pin_drop_outlined),
            _NavItemData('Opinion Inbox', '/opinions/inbox', Icons.message_outlined),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book_outlined),
            _NavItemData('My tickets', '/support', Icons.support_agent_outlined),
            _NavItemData('Settings', '/settings', Icons.settings_outlined),
          ]),
        ];
      case 'SECTION_OFFICER':
      case 'USER':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard_outlined),
            _NavItemData('My Files', '/files', Icons.folder_outlined),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox_outlined),
            _NavItemData('Track File', '/files/track', Icons.pin_drop_outlined),
            _NavItemData('Opinion Inbox', '/opinions/inbox', Icons.message_outlined),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book_outlined),
            _NavItemData('My tickets', '/support', Icons.support_agent_outlined),
            _NavItemData('Settings', '/settings', Icons.settings_outlined),
          ]),
        ];
      case 'APPROVAL_AUTHORITY':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard_outlined),
            _NavItemData('My Files', '/files', Icons.folder_outlined),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox_outlined),
            _NavItemData('Pending Approvals', '/files/approvals', Icons.pending_actions_outlined),
            _NavItemData('Track File', '/files/track', Icons.pin_drop_outlined),
            _NavItemData('Opinion Inbox', '/opinions/inbox', Icons.message_outlined),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book_outlined),
            _NavItemData('My tickets', '/support', Icons.support_agent_outlined),
            _NavItemData('Settings', '/settings', Icons.settings_outlined),
          ]),
        ];
      case 'DISPATCHER':
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard_outlined),
            _NavItemData('Ready for Dispatch', '/dispatch', Icons.send_outlined),
            _NavItemData('Dispatch History', '/dispatch/history', Icons.history),
            _NavItemData('Track File', '/files/track', Icons.pin_drop_outlined),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book_outlined),
            _NavItemData('My tickets', '/support', Icons.support_agent_outlined),
            _NavItemData('Settings', '/settings', Icons.settings_outlined),
          ]),
        ];
      default:
        return [
          _NavGroup(title: 'Platform', items: [
            _NavItemData('Dashboard', '/dashboard', Icons.dashboard_outlined),
            _NavItemData('My Files', '/files', Icons.folder_outlined),
            _NavItemData('Inbox', '/files/inbox', Icons.inbox_outlined),
            _NavItemData('Track File', '/files/track', Icons.pin_drop_outlined),
            _NavItemData('Opinion Inbox', '/opinions/inbox', Icons.message_outlined),
          ]),
          _NavGroup(title: 'Other', items: [
            _NavItemData('Documentation', '/docs', Icons.menu_book_outlined),
            _NavItemData('My tickets', '/support', Icons.support_agent_outlined),
            _NavItemData('Settings', '/settings', Icons.settings_outlined),
          ]),
        ];
    }
  }
}

class _PointsHeaderAction extends StatefulWidget {
  final String userId;

  const _PointsHeaderAction({required this.userId});

  @override
  State<_PointsHeaderAction> createState() => _PointsHeaderActionState();
}

class _PointsHeaderActionState extends State<_PointsHeaderAction> {
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
    return FHeaderAction(
      icon: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(FIcons.star, size: 18, color: context.theme.colors.primary),
          const SizedBox(width: 6),
          Text(
            '$_points',
            style: context.theme.typography.sm.copyWith(
              fontWeight: FontWeight.w600,
              color: context.theme.colors.foreground,
            ),
          ),
        ],
      ),
      onPress: () => context.push('/profile'),
    );
  }
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
