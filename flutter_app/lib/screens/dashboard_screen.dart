import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/models/file_model.dart';
import 'package:efiling_app/models/user_model.dart';
import 'package:efiling_app/core/theme/app_colors.dart';
import 'package:efiling_app/core/theme/app_spacing.dart';
import 'package:efiling_app/core/widgets/skeleton_loader.dart';

/// Dashboard matching web: welcome, stats cards, recent files, quick actions.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<FileModel> _files = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient().get<dynamic>('/files');
      final data = res.data;
      List list = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      setState(() {
        _files = list.map((e) => FileModel.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  int get _total => _files.length;
  int get _pending => _files.where((f) => f.status == 'PENDING').length;
  int get _inProgress => _files.where((f) => f.status == 'IN_PROGRESS').length;
  int get _redListed => _files.where((f) => f.isRedListed).length;

  bool _canCreateFiles(UserModel? user) {
    if (user == null) return false;
    // Match web: INWARD_DESK and DISPATCHER cannot create new files.
    return !(user.hasRole('INWARD_DESK') || user.hasRole('DISPATCHER'));
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final theme = Theme.of(context);
    final firstName = user?.name.split(' ').first ?? '';
    final canCreate = _canCreateFiles(user);
    final canManageUsers = user?.hasAnyRole(['DEPT_ADMIN', 'SUPER_ADMIN']) == true;

    if (_loading) {
      return const DashboardSkeleton();
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('Welcome back, $firstName!', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(width: 8),
                  const Icon(Icons.auto_awesome, color: AppColors.amber, size: 24),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                "Here's an overview of your file activity for today, ${DateFormat('EEEE, MMMM d').format(DateTime.now())}",
                style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: () => context.push('/files/track'),
                      icon: const Icon(Icons.search, size: 20),
                      label: const Text('Track File'),
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: canCreate ? () => context.push('/files/new') : null,
                      icon: const Icon(Icons.add, size: 20),
                      label: const Text('Create New File'),
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: MediaQuery.of(context).size.width > 800 ? 4 : 2,
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childAspectRatio: 1.4,
            children: [
              _StatCard(title: 'Total Files', value: '$_total', subtitle: 'All files in system', icon: Icons.description, color: theme.colorScheme.primary, onTap: () => context.push('/files/inbox')),
              _StatCard(title: 'Pending', value: '$_pending', subtitle: 'Awaiting your action', icon: Icons.schedule, color: AppColors.amber, onTap: () => context.push('/files/inbox?status=PENDING')),
              _StatCard(title: 'In Progress', value: '$_inProgress', subtitle: 'Being processed', icon: Icons.trending_up, color: AppColors.blue, onTap: () => context.push('/files/inbox?status=IN_PROGRESS')),
              _StatCard(title: 'Red Listed', value: '$_redListed', subtitle: 'Overdue files', icon: Icons.warning_amber, color: AppColors.red, onTap: () => context.push('/files/inbox?redlisted=true')),
            ],
          ),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Recent Files', style: theme.textTheme.titleLarge),
                          Text('Latest files that need your attention', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                        ],
                      ),
                      TextButton.icon(onPressed: () => context.push('/files/inbox'), icon: const Icon(Icons.arrow_forward, size: 16), label: const Text('View All')),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (_files.isEmpty)
                    Center(
                      child: Column(
                        children: [
                          Icon(Icons.inbox, size: 48, color: theme.colorScheme.onSurfaceVariant),
                          const SizedBox(height: 8),
                          Text('No files yet', style: theme.textTheme.titleMedium),
                          Text('Create your first file to get started', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            icon: const Icon(Icons.add),
                            label: const Text('Create File'),
                            onPressed: canCreate ? () => context.push('/files/new') : null,
                          ),
                        ],
                      ),
                    )
                  else
                    ..._files.take(6).map((f) => _RecentFileTile(file: f)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Quick Actions', style: theme.textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text('Common tasks and shortcuts', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(icon: const Icon(Icons.inbox, size: 20), label: Text('View Inbox${_pending > 0 ? ' ($_pending)' : ''}'), onPressed: () => context.push('/files/inbox')),
                      OutlinedButton.icon(icon: const Icon(Icons.add, size: 20), label: const Text('Create New File'), onPressed: canCreate ? () => context.push('/files/new') : null),
                      OutlinedButton.icon(icon: const Icon(Icons.search, size: 20), label: const Text('Track File'), onPressed: () => context.push('/files/track')),
                      if (canManageUsers)
                        OutlinedButton.icon(icon: const Icon(Icons.people, size: 20), label: const Text('Manage Users'), onPressed: () => context.push('/admin/users')),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _StatCard({required this.title, required this.value, required this.subtitle, required this.icon, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(title, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: color.withOpacity( 0.15), borderRadius: BorderRadius.circular(12)),
                    child: Icon(icon, color: color, size: 24),
                  ),
                ],
              ),
              Text(value, style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
              Text(subtitle, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecentFileTile extends StatelessWidget {
  final FileModel file;

  const _RecentFileTile({required this.file});

  static Color _priorityColor(String p) {
    switch (p) {
      case 'URGENT': return AppColors.red;
      case 'HIGH': return AppColors.amber;
      case 'NORMAL': return AppColors.blue;
      default: return AppColors.slate;
    }
  }

  static String _statusLabel(String s) {
    switch (s) {
      case 'PENDING': return 'Pending';
      case 'IN_PROGRESS': return 'In Progress';
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'ON_HOLD': return 'On Hold';
      default: return s;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final created = file.createdAt != null ? _formatRelative(file.createdAt!) : '';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(width: 8, height: 8, decoration: BoxDecoration(color: _priorityColor(file.priority), shape: BoxShape.circle)),
      title: Row(
        children: [
          Expanded(child: Text(file.subject, overflow: TextOverflow.ellipsis)),
          if (file.isRedListed) Container(margin: const EdgeInsets.only(left: 8), padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: AppColors.red.withOpacity( 0.2), borderRadius: BorderRadius.circular(4)), child: Text('RED', style: theme.textTheme.labelSmall?.copyWith(color: AppColors.red))),
        ],
      ),
      subtitle: Text('${file.fileNumber} • ${file.departmentName}${created.isNotEmpty ? ' • $created' : ''}', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant), maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: Text(_statusLabel(file.status), style: theme.textTheme.labelSmall),
      onTap: () => context.push('/files/${file.id}'),
    );
  }

  String _formatRelative(DateTime d) {
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'Just now';
  }
}
