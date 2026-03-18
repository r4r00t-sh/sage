# Flutter ↔ Web Parity Map (Sidebar Order)

This document tracks feature parity between the **Web (Next.js)** app and the **Flutter** app, in the same order as the web sidebar (`frontend/components/app-sidebar.tsx`).

Legend:
- **✅** Implemented (feature parity)
- **🟡** Partially implemented (missing key behaviors/UI)
- **❌** Missing in Flutter

## Platform

| Sidebar item | Web route(s) | Flutter route(s) | Flutter screen(s) | Status | Gap notes |
|---|---|---|---|---:|---|
| Dashboard | `frontend/app/dashboard/page.tsx` | `/dashboard` | `flutter_app/lib/screens/dashboard_screen.dart` | 🟡 | Need to compare web cards/metrics/role widgets. |
| My Files | `frontend/app/files/page.tsx` | `/files` | `flutter_app/lib/screens/files/files_list_screen.dart` | 🟡 | Grid/list UX differs; missing advanced filters/sort/export parity. |
| Inbox | `frontend/app/files/inbox/page.tsx` | `/files/inbox` | `flutter_app/lib/screens/files/inbox_screen.dart` | 🟡 | Missing queue section + some web bulk actions/filter chips parity; row menu now has Track/Forward/View. |
| New File | `frontend/app/files/new/page.tsx` | `/files/new` | `flutter_app/lib/screens/files/new_file_screen.dart` | 🟡 | Needs attachment validation/limits + post-create navigate to created file detail. |
| Track File | `frontend/app/files/track/page.tsx` + `frontend/app/files/track/[id]/page.tsx` | `/files/track`, `/files/track/:id` | `flutter_app/lib/screens/files/track_file_screen.dart`, `flutter_app/lib/screens/files/track_file_detail_screen.dart` | 🟡 | Verify search/filters + tracking timeline fields match web. |
| Pending Approvals | `frontend/app/files/approvals/page.tsx` | `/files/approvals` | `flutter_app/lib/screens/files/approvals_screen.dart` | 🟡 | Verify actions/approve/forward flow parity. |
| Opinion Inbox | `frontend/app/opinions/inbox/page.tsx` | `/opinions/inbox` | `flutter_app/lib/screens/opinions/opinions_inbox_screen.dart` | 🟡 | Verify statuses/actions parity. |
| Opinion Detail | `frontend/app/opinions/[id]/page.tsx` | `/opinions/:id` | `flutter_app/lib/screens/opinions/opinion_detail_screen.dart` | 🟡 | Verify request/response + attachments parity. |
| Dispatch (Ready) | `frontend/app/dispatch/page.tsx` | `/dispatch` | `flutter_app/lib/screens/dispatch/dispatch_screen.dart` | 🟡 | Verify scanning/QR/export parity. |
| Dispatch History | `frontend/app/dispatch/history/page.tsx` | `/dispatch/history` | `flutter_app/lib/screens/dispatch/dispatch_history_screen.dart` | 🟡 | Verify filters/export parity. |
| Chat | `frontend/app/chat/page.tsx` + `frontend/app/chat/[id]/page.tsx` | `/chat`, `/chat/:id`, `/chat/new`, `/chat/new/group` | `flutter_app/lib/screens/chat/*` | 🟡 | Verify feature parity: groups, roles, attachments, admin capabilities. |
| Search | `frontend/app/search/page.tsx` | `/search` | `flutter_app/lib/screens/global_search_screen.dart` | 🟡 | Verify command palette/search filters parity. |
| Notifications | (web: notifications via navbar?) | `/notifications` | `flutter_app/lib/screens/notifications_screen.dart` | 🟡 | Confirm web feature source and parity. |
| Help/Docs | `frontend/app/docs/page.tsx` | `/help` | `flutter_app/lib/screens/help_screen.dart` | 🟡 | Web has docs; Flutter has help. Need docs parity. |
| Settings | `frontend/app/settings/page.tsx` | `/settings` | `flutter_app/lib/screens/settings_screen.dart` | 🟡 | Verify settings options parity. |
| Profile | `frontend/app/profile/page.tsx` + `frontend/app/profile/change-password/page.tsx` + `frontend/app/profile/complete/page.tsx` | `/profile` | `flutter_app/lib/screens/profile_screen.dart` | 🟡 | Missing change password + complete profile flows (as routes). |
| Desk Profile | `frontend/app/desk-profile/page.tsx` | ❌ | ❌ | ❌ | Flutter missing desk profile route/screen. |

## Admin

| Sidebar item | Web route(s) | Flutter route(s) | Flutter screen(s) | Status | Gap notes |
|---|---|---|---|---:|---|
| Active Desk | `frontend/app/admin/desk/page.tsx` | `/admin/desk` | `flutter_app/lib/screens/admin/active_desk_screen.dart` | 🟡 | Verify parity for actions + live desk view. |
| Desk Capacity | `frontend/app/admin/desks/page.tsx` | `/admin/desks` | `flutter_app/lib/screens/admin/desks_screen.dart` | 🟡 | Verify filters + capacity operations parity. |
| Capacity Management | `frontend/app/admin/capacity/page.tsx` | ❌ | ❌ | ❌ | Missing route/screen in Flutter. |
| Workflows | `frontend/app/admin/workflows/page.tsx` | `/admin/workflows` | `flutter_app/lib/screens/admin/workflows_screen.dart` | 🟡 | Verify list actions parity. |
| Workflow Builder | `frontend/app/admin/workflows/[id]/builder/page.tsx` | `/admin/workflows/:id/builder` | `flutter_app/lib/screens/admin/workflow_builder_screen.dart` | 🟡 | Major parity risk: node/edge editing behaviors. |
| Users | `frontend/app/admin/users/page.tsx` + `frontend/app/admin/users/[id]/page.tsx` | `/admin/users`, `/admin/users/:id` | `flutter_app/lib/screens/admin/users_screen.dart`, `flutter_app/lib/screens/admin/user_detail_screen.dart` | 🟡 | Verify role mgmt, reset pwd, filters parity. |
| Departments | `frontend/app/admin/departments/page.tsx` + dept/division detail pages | ❌ | ❌ | ❌ | Missing routes/screens in Flutter. |
| Documents | `frontend/app/admin/documents/page.tsx` | `/admin/documents` | `flutter_app/lib/screens/admin/documents_screen.dart` | 🟡 | Verify templates, versions, actions parity. |
| Recall Protocol | `frontend/app/admin/recall/page.tsx` | `/admin/recall` | `flutter_app/lib/screens/admin/recall_screen.dart` | 🟡 | Verify recall flows parity. |
| Features | `frontend/app/admin/features/page.tsx` | ❌ | ❌ | ❌ | Missing in Flutter. |
| Analytics Overview | `frontend/app/admin/analytics/page.tsx` | `/admin/analytics` | `flutter_app/lib/screens/admin/analytics_screen.dart` | 🟡 | Verify charts/filters parity. |
| Desk Performance | `frontend/app/admin/analytics/desk-performance/page.tsx` | ❌ | ❌ | ❌ | Missing dedicated Flutter screen/route. |

## Support / Tickets

| Sidebar item | Web route(s) | Flutter route(s) | Flutter screen(s) | Status | Gap notes |
|---|---|---|---|---:|---|
| Support panel (tickets) | `frontend/app/support/page.tsx`, `frontend/app/support/new/page.tsx`, `frontend/app/support/[id]/page.tsx` | ❌ | ❌ | ❌ | Missing ticket system screens in Flutter. |

## Notes on role-based navigation parity
- Web sidebar items vary by role (INWARD_DESK, SECTION_OFFICER, APPROVAL_AUTHORITY, DISPATCHER, USER, CHAT_MANAGER, DEPT_ADMIN, SUPER_ADMIN, SUPPORT).\n+- Flutter currently has role-specific drawer items in `flutter_app/lib/screens/shell_screen.dart`, but it does **not** yet match all web roles/items (notably: Departments, Support tickets, Capacity Management, Desk Performance, Features, Desk Profile).\n+
