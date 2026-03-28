import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/theme/app_colors.dart';

class UserDetailScreen extends StatefulWidget {
  const UserDetailScreen({super.key, required this.userId});

  final String userId;

  @override
  State<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends State<UserDetailScreen> {
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _presence;
  bool _loading = true;
  String? _error;
  bool _actionBusy = false;

  String _errMsg(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && d['message'] != null) return d['message'].toString();
      return e.message ?? e.toString();
    }
    return e.toString();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient().get<Map<String, dynamic>>('/users/${widget.userId}');
      if (mounted) setState(() => _user = res.data);
      try {
        final pres = await ApiClient().get<Map<String, dynamic>>('/users/${widget.userId}/presence');
        if (mounted && pres.data != null) setState(() => _presence = pres.data);
      } catch (_) {}
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() {
        _error = e.toString().replaceFirst('DioException: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text('Failed to load user', style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 24),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
              const SizedBox(height: 8),
              TextButton(onPressed: () => context.go('/admin/users'), child: const Text('Back to Users')),
            ],
          ),
        ),
      );
    }
    final u = _user!;
    final name = u['name']?.toString() ?? '';
    final username = u['username']?.toString() ?? '';
    final email = u['email']?.toString() ?? '';
    final roles = (u['roles'] as List<dynamic>?)?.join(', ') ?? u['role']?.toString() ?? '';
    final isActive = u['isActive'] == true;
    final auth = context.watch<AuthProvider>();
    final me = auth.user;
    final isSelf = me?.id == widget.userId;
    final canHardDelete = me?.canPermanentlyDeleteUsers == true && !isSelf;
    final dept = u['department'] is Map ? (u['department'] as Map)['name']?.toString() : null;
    final division = u['division'] is Map ? (u['division'] as Map)['name']?.toString() : null;
    final points = u['points'] is num ? (u['points'] as num).toInt() : 0;
    final counts = u['_count'] is Map ? u['_count'] as Map<String, dynamic> : null;
    final filesCreated = counts?['filesCreated'] is num ? (counts!['filesCreated'] as num).toInt() : 0;
    final filesAssigned = counts?['filesAssigned'] is num ? (counts!['filesAssigned'] as num).toInt() : 0;
    final notes = counts?['notes'] is num ? (counts!['notes'] as num).toInt() : 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.go('/admin/users'),
              ),
              const SizedBox(width: 8),
              Text('User details', style: theme.textTheme.headlineSmall),
            ],
          ),
          if (_presence != null) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Presence', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _presence!['status'] == 'ACTIVE' ? AppColors.green : theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(_presence!['statusLabel']?.toString() ?? _presence!['status']?.toString() ?? '—', style: theme.textTheme.bodyMedium),
                      ],
                    ),
                    if (_presence!['lastPing'] != null) ...[
                      const SizedBox(height: 4),
                      Text('Last ping: ${DateFormat.MMMd().add_Hm().format(DateTime.parse(_presence!['lastPing'].toString()))}', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ],
                    if (_presence!['loginTime'] != null) ...[
                      const SizedBox(height: 4),
                      Text('Login: ${DateFormat.MMMd().add_Hm().format(DateTime.parse(_presence!['loginTime'].toString()))}', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 40,
                        child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: theme.textTheme.headlineMedium),
                      ),
                      const SizedBox(width: 24),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: theme.textTheme.headlineSmall),
                            const SizedBox(height: 4),
                            Text('@$username', style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                            if (email.isNotEmpty) Text(email, style: theme.textTheme.bodyMedium),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              children: [
                                Chip(
                                  label: Text(isActive ? 'Active' : 'Inactive'),
                                  backgroundColor: isActive ? theme.colorScheme.primaryContainer : theme.colorScheme.surfaceContainerHighest,
                                ),
                                if (roles.isNotEmpty) Chip(label: Text(roles)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Divider(),
                  const SizedBox(height: 16),
                  Text('Department & division', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.business_outlined),
                    title: Text(dept ?? '—'),
                    subtitle: division != null ? Text(division) : null,
                  ),
                  const SizedBox(height: 16),
                  Text('Activity', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _StatChip(label: 'Points', value: '$points', icon: Icons.star_outline),
                      const SizedBox(width: 16),
                      _StatChip(label: 'Files created', value: '$filesCreated', icon: Icons.add_circle_outline),
                      const SizedBox(width: 16),
                      _StatChip(label: 'Files assigned', value: '$filesAssigned', icon: Icons.assignment_outlined),
                      const SizedBox(width: 16),
                      _StatChip(label: 'Notes', value: '$notes', icon: Icons.note_outlined),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (!isSelf) ...[
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Account actions', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 12),
                    FilledButton.tonalIcon(
                      onPressed: _actionBusy
                          ? null
                          : () async {
                              final title = isActive ? 'Deactivate user' : 'Activate user';
                              final body = isActive
                                  ? 'Deactivated users cannot log in. You can activate them again later from the user list.'
                                  : 'This user will be able to log in again.';
                              final ok = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: Text(title),
                                  content: Text(body),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                    FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(isActive ? 'Deactivate' : 'Activate')),
                                  ],
                                ),
                              );
                              if (ok != true || !mounted) return;
                              setState(() => _actionBusy = true);
                              try {
                                await ApiClient().put('/users/${widget.userId}', data: {'isActive': !isActive});
                                if (!mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(isActive ? 'User deactivated' : 'User activated')),
                                );
                                await _load();
                              } catch (e) {
                                if (!mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(_errMsg(e)), backgroundColor: theme.colorScheme.error),
                                );
                              } finally {
                                if (mounted) setState(() => _actionBusy = false);
                              }
                            },
                      icon: Icon(isActive ? Icons.person_off_outlined : Icons.person_outline),
                      label: Text(isActive ? 'Deactivate' : 'Activate'),
                    ),
                    if (canHardDelete) ...[
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _actionBusy
                            ? null
                            : () async {
                                final ok = await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Delete user permanently?'),
                                    content: const Text(
                                      'This permanently removes the account from the database. Files and notes they created stay in the system but are attributed to another active user. This cannot be undone.',
                                    ),
                                    actions: [
                                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                      FilledButton(
                                        style: FilledButton.styleFrom(
                                          backgroundColor: theme.colorScheme.error,
                                          foregroundColor: theme.colorScheme.onError,
                                        ),
                                        onPressed: () => Navigator.pop(ctx, true),
                                        child: const Text('Delete permanently'),
                                      ),
                                    ],
                                  ),
                                );
                                if (ok != true || !mounted) return;
                                setState(() => _actionBusy = true);
                                try {
                                  await ApiClient().delete('/users/${widget.userId}');
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('User deleted permanently')),
                                  );
                                  context.go('/admin/users');
                                } catch (e) {
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(_errMsg(e)), backgroundColor: theme.colorScheme.error),
                                  );
                                } finally {
                                  if (mounted) setState(() => _actionBusy = false);
                                }
                              },
                        icon: const Icon(Icons.delete_forever_outlined),
                        label: const Text('Delete permanently'),
                        style: OutlinedButton.styleFrom(foregroundColor: theme.colorScheme.error),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _StatChip({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Icon(icon, size: 20, color: theme.colorScheme.primary),
        const SizedBox(height: 4),
        Text(value, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        Text(label, style: theme.textTheme.labelSmall),
      ],
    );
  }
}
