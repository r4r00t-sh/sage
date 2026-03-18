import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/theme/app_colors.dart';
import 'package:efiling_app/core/utils/responsive.dart';
import 'package:efiling_app/models/file_model.dart';

/// Pending Approvals – files awaiting approval (APPROVAL_AUTHORITY).
/// Responsive: list on phone, optional table on tablet.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  List<FileModel> _files = [];
  bool _loading = true;
  String? _error;

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
      // Match web: pending approvals are "assignedToMe=true"
      final res = await ApiClient().get<dynamic>('/files', queryParameters: {'assignedToMe': 'true'});
      final data = res.data;
      final raw = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      final all = list.map((e) => FileModel.fromJson(e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{})).toList();
      if (mounted) {
        setState(() {
          _files = all;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('DioException: ', '');
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isWide = Responsive.isWide(context);
    final padding = Responsive.padding(context);

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: padding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text('Failed to load approvals', style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
              const SizedBox(height: 24),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: padding.copyWith(top: 16, bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Pending Approvals', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('Files awaiting your approval', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 8),
                  Text('${_files.length} file(s)', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
          ),
          if (_files.isEmpty)
            const SliverFillRemaining(
              child: Center(child: Text('No pending approvals')),
            )
          else if (isWide)
            SliverPadding(
              padding: padding,
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final f = _files[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: f.priority == 'URGENT' ? AppColors.red : theme.colorScheme.primaryContainer,
                          child: Icon(Icons.pending_actions, color: f.priority == 'URGENT' ? Colors.white : theme.colorScheme.onPrimaryContainer),
                        ),
                        title: Text(f.subject, overflow: TextOverflow.ellipsis),
                        subtitle: Text('${f.fileNumber} • ${f.status}'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/files/${f.id}'),
                      ),
                    );
                  },
                  childCount: _files.length,
                ),
              ),
            )
          else
            SliverPadding(
              padding: padding,
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final f = _files[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: f.priority == 'URGENT' ? AppColors.red : theme.colorScheme.primaryContainer,
                          child: Icon(Icons.pending_actions, color: f.priority == 'URGENT' ? Colors.white : theme.colorScheme.onPrimaryContainer),
                        ),
                        title: Text(f.subject, overflow: TextOverflow.ellipsis),
                        subtitle: Text('${f.fileNumber} • ${f.status}'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/files/${f.id}'),
                      ),
                    );
                  },
                  childCount: _files.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
