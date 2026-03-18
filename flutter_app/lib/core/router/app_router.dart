import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/screens/login_screen.dart';
import 'package:efiling_app/screens/shell_screen.dart';
import 'package:efiling_app/screens/dashboard_screen.dart';
import 'package:efiling_app/screens/files/files_list_screen.dart';
import 'package:efiling_app/screens/files/inbox_screen.dart';
import 'package:efiling_app/screens/files/file_detail_screen.dart';
import 'package:efiling_app/screens/files/new_file_screen.dart';
import 'package:efiling_app/screens/files/track_file_screen.dart';
import 'package:efiling_app/screens/files/track_file_detail_screen.dart';
import 'package:efiling_app/screens/files/approvals_screen.dart';
import 'package:efiling_app/screens/admin/workflow_builder_screen.dart';
import 'package:efiling_app/screens/dispatch/dispatch_screen.dart';
import 'package:efiling_app/screens/dispatch/dispatch_history_screen.dart';
import 'package:efiling_app/screens/opinions/opinions_inbox_screen.dart';
import 'package:efiling_app/screens/opinions/opinion_detail_screen.dart';
import 'package:efiling_app/screens/admin/users_screen.dart';
import 'package:efiling_app/screens/admin/user_detail_screen.dart';
import 'package:efiling_app/screens/admin/analytics_screen.dart';
import 'package:efiling_app/screens/admin/desks_screen.dart';
import 'package:efiling_app/screens/admin/active_desk_screen.dart';
import 'package:efiling_app/screens/admin/documents_screen.dart';
import 'package:efiling_app/screens/admin/recall_screen.dart';
import 'package:efiling_app/screens/admin/workflows_screen.dart';
import 'package:efiling_app/screens/admin/capacity_management_screen.dart';
import 'package:efiling_app/screens/admin/departments_screen.dart';
import 'package:efiling_app/screens/admin/department_detail_screen.dart';
import 'package:efiling_app/screens/admin/features_screen.dart';
import 'package:efiling_app/screens/chat/chat_list_screen.dart';
import 'package:efiling_app/screens/chat/chat_detail_screen.dart';
import 'package:efiling_app/screens/chat/chat_user_picker_screen.dart';
import 'package:efiling_app/screens/chat/chat_create_group_screen.dart';
import 'package:efiling_app/screens/settings_screen.dart';
import 'package:efiling_app/screens/profile_screen.dart';
import 'package:efiling_app/screens/notifications_screen.dart';
import 'package:efiling_app/screens/help_screen.dart';
import 'package:efiling_app/screens/global_search_screen.dart';
import 'package:efiling_app/screens/docs_screen.dart';
import 'package:efiling_app/screens/support/tickets_list_screen.dart';
import 'package:efiling_app/screens/support/new_ticket_screen.dart';
import 'package:efiling_app/screens/support/ticket_detail_screen.dart';

class AppRouter {
  static GoRouter router(AuthProvider auth) {
    return GoRouter(
      initialLocation: '/login',
      refreshListenable: auth,
      redirect: (context, state) {
        final isLoggedIn = auth.isAuthenticated;
        final isLoginRoute = state.matchedLocation == '/login';
        if (!isLoggedIn && !isLoginRoute) return '/login';
        if (isLoggedIn && isLoginRoute) return '/dashboard';
        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        ShellRoute(
          builder: (context, state, child) => ShellScreen(
            child: child,
            currentPath: state.uri.path,
          ),
          routes: [
            GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
            GoRoute(path: '/files', builder: (_, __) => const FilesListScreen()),
            GoRoute(
              path: '/files/inbox',
              builder: (context, state) {
                final status = state.uri.queryParameters['status'];
                final redlisted = state.uri.queryParameters['redlisted'] == 'true';
                return InboxScreen(initialStatus: status, initialRedlisted: redlisted);
              },
            ),
            GoRoute(path: '/files/new', builder: (_, __) => const NewFileScreen()),
            GoRoute(path: '/files/track', builder: (_, __) => const TrackFileScreen()),
            GoRoute(
              path: '/files/track/:id',
              builder: (context, state) {
                final id = state.pathParameters['id']!;
                return TrackFileDetailScreen(fileId: id);
              },
            ),
            GoRoute(path: '/files/approvals', builder: (_, __) => const ApprovalsScreen()),
            GoRoute(
              path: '/files/:id',
              builder: (context, state) {
                final id = state.pathParameters['id']!;
                final action = state.uri.queryParameters['action'];
                return FileDetailScreen(fileId: id, openForwardOnStart: action == 'forward');
              },
            ),
            GoRoute(path: '/opinions/inbox', builder: (_, __) => const OpinionsInboxScreen()),
            GoRoute(
              path: '/opinions/:id',
              builder: (context, state) {
                final id = state.pathParameters['id']!;
                return OpinionDetailScreen(opinionRequestId: id);
              },
            ),
            GoRoute(path: '/admin/users', builder: (_, __) => const UsersScreen()),
            GoRoute(
              path: '/admin/users/:id',
              builder: (context, state) {
                final id = state.pathParameters['id']!;
                return UserDetailScreen(userId: id);
              },
            ),
            GoRoute(path: '/admin/analytics', builder: (_, __) => const AnalyticsScreen()),
            GoRoute(path: '/admin/desks', builder: (_, __) => const DesksScreen()),
            GoRoute(path: '/admin/desk', builder: (_, __) => const ActiveDeskScreen()),
            GoRoute(path: '/admin/capacity', builder: (_, __) => const CapacityManagementScreen()),
            GoRoute(path: '/admin/features', builder: (_, __) => const FeaturesScreen()),
            GoRoute(path: '/admin/departments', builder: (_, __) => const DepartmentsScreen()),
            GoRoute(
              path: '/admin/departments/:id',
              builder: (context, state) {
                final id = state.pathParameters['id']!;
                return DepartmentDetailScreen(departmentId: id);
              },
            ),
            GoRoute(path: '/admin/documents', builder: (_, __) => const DocumentsScreen()),
            GoRoute(path: '/admin/recall', builder: (_, __) => const RecallScreen()),
            GoRoute(path: '/admin/workflows', builder: (_, __) => const WorkflowsScreen()),
            GoRoute(
              path: '/admin/workflows/:id/builder',
              builder: (context, state) {
                final id = state.pathParameters['id']!;
                return WorkflowBuilderScreen(workflowId: id);
              },
            ),
            GoRoute(path: '/dispatch', builder: (_, __) => const DispatchScreen()),
            GoRoute(path: '/dispatch/history', builder: (_, __) => const DispatchHistoryScreen()),
            GoRoute(path: '/chat', builder: (_, __) => const ChatListScreen()),
            GoRoute(path: '/chat/new', builder: (_, __) => const ChatUserPickerScreen()),
            GoRoute(path: '/chat/new/group', builder: (_, __) => const ChatCreateGroupScreen()),
            GoRoute(
              path: '/chat/:id',
              builder: (context, state) {
                final id = state.pathParameters['id']!;
                return ChatDetailScreen(conversationId: id);
              },
            ),
            GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
            GoRoute(path: '/help', builder: (_, __) => const HelpScreen()),
            GoRoute(path: '/docs', builder: (_, __) => const DocsScreen()),
            GoRoute(path: '/search', builder: (_, __) => const GlobalSearchScreen()),
            GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
            GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
            GoRoute(path: '/support', builder: (_, __) => const TicketsListScreen()),
            GoRoute(path: '/support/new', builder: (_, __) => const NewTicketScreen()),
            GoRoute(
              path: '/support/:id',
              builder: (context, state) {
                final id = state.pathParameters['id']!;
                return TicketDetailScreen(ticketId: id);
              },
            ),
          ],
        ),
      ],
    );
  }
}
