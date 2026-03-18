import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/utils/responsive.dart';

class DepartmentDetailScreen extends StatefulWidget {
  const DepartmentDetailScreen({super.key, required this.departmentId});

  final String departmentId;

  @override
  State<DepartmentDetailScreen> createState() => _DepartmentDetailScreenState();
}

class _DepartmentDetailScreenState extends State<DepartmentDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _department;
  List<Map<String, dynamic>> _divisions = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        ApiClient().get<dynamic>('/departments/${widget.departmentId}'),
        ApiClient().get<dynamic>('/departments/${widget.departmentId}/divisions'),
      ]);
      final deptRes = results[0].data;
      final divRes = results[1].data;
      final divRaw = divRes is List ? divRes : (divRes is Map && divRes['data'] != null ? divRes['data'] as List : []);

      if (mounted) {
        setState(() {
          _department = deptRes is Map ? Map<String, dynamic>.from(deptRes as Map) : null;
          _divisions = (divRaw is List ? divRaw : const []).map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString().replaceFirst('DioException: ', ''); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: padding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 12),
              Text('Failed to load department', style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
              const SizedBox(height: 8),
              TextButton(onPressed: () => context.go('/admin/departments'), child: const Text('Back')),
            ],
          ),
        ),
      );
    }

    final deptName = _department?['name']?.toString() ?? 'Department';
    final code = _department?['code']?.toString() ?? '';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: EdgeInsets.fromLTRB(padding.left, 16, padding.right, 24),
        children: [
          Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.go('/admin/departments')),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(deptName, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                    if (code.isNotEmpty) Text(code, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Divisions', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  if (_divisions.isEmpty)
                    Text('No divisions', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))
                  else
                    ..._divisions.map((d) {
                      final name = d['name']?.toString() ?? '—';
                      final dcode = d['code']?.toString() ?? '';
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.account_tree_outlined),
                        title: Text(name),
                        subtitle: dcode.isNotEmpty ? Text(dcode) : null,
                      );
                    }),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

