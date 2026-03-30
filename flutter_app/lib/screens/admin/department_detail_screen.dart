import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/utils/responsive.dart';
import 'package:efiling_app/models/user_model.dart';

String _apiErrMsg(Object e) {
  if (e is DioException) {
    final d = e.response?.data;
    if (d is Map && d['message'] is String) return d['message'] as String;
    return e.message ?? e.toString();
  }
  return e.toString().replaceFirst('DioException: ', '');
}

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
  bool _accessChecked = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_accessChecked) return;
    _accessChecked = true;
    final user = context.read<AuthProvider>().user;
    if (user != null &&
        !user.hasAnyRole(
            ['SUPER_ADMIN', 'DEPT_ADMIN', 'DEVELOPER', 'APPROVAL_AUTHORITY'])) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/dashboard');
      });
    }
  }

  void _maybeRedirectOutOfScope() {
    final UserModel? user = context.read<AuthProvider>().user;
    if (user == null) return;
    if (user.hasGodRole) return;
    if (!user.hasMultiDepartmentRole) return;
    if (user.isDepartmentInScope(widget.departmentId)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go('/admin/departments');
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiClient().get<dynamic>('/departments/${widget.departmentId}'),
        ApiClient().get<dynamic>('/departments/${widget.departmentId}/divisions'),
      ]);
      final deptRes = results[0].data;
      final divRes = results[1].data;
      final divRaw = divRes is List
          ? divRes
          : (divRes is Map && divRes['data'] != null
              ? divRes['data'] as List
              : []);

      if (mounted) {
        setState(() {
          _department =
              deptRes is Map ? Map<String, dynamic>.from(deptRes as Map) : null;
          _divisions = (divRaw is List ? divRaw : const [])
              .map((e) => e is Map
                  ? Map<String, dynamic>.from(e as Map)
                  : <String, dynamic>{})
              .toList();
          _loading = false;
        });
        _maybeRedirectOutOfScope();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _apiErrMsg(e);
        });
      }
    }
  }

  Future<void> _showAddDivisionDialog() async {
    final user = context.read<AuthProvider>().user;
    if (user == null || !user.hasGodRole) return;

    await showDialog<void>(
      context: context,
      builder: (ctx) => _AddDivisionDialog(
        departmentId: widget.departmentId,
        onAdded: () {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Division added')),
          );
          _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);
    final user = context.watch<AuthProvider>().user;
    final canManage = user?.hasGodRole == true;

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
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.go('/admin/departments'),
                child: const Text('Back'),
              ),
            ],
          ),
        ),
      );
    }

    final deptName = _department?['name']?.toString() ?? 'Department';
    final code = _department?['code']?.toString() ?? '';
    final org = _department?['organisation'];
    final orgName = org is Map ? org['name']?.toString() : null;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: EdgeInsets.fromLTRB(padding.left, 16, padding.right, 24),
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => context.go('/admin/departments'),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      deptName,
                      style: theme.textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    if (code.isNotEmpty)
                      Text(
                        code,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    if (orgName != null && orgName.isNotEmpty)
                      Text(
                        orgName,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Divisions',
                          style: theme.textTheme.titleMedium,
                        ),
                      ),
                      if (canManage)
                        TextButton.icon(
                          onPressed: _showAddDivisionDialog,
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Add'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_divisions.isEmpty)
                    Text(
                      'No divisions',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    )
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

class _AddDivisionDialog extends StatefulWidget {
  const _AddDivisionDialog({
    required this.departmentId,
    required this.onAdded,
  });

  final String departmentId;
  final VoidCallback onAdded;

  @override
  State<_AddDivisionDialog> createState() => _AddDivisionDialogState();
}

class _AddDivisionDialogState extends State<_AddDivisionDialog> {
  late final TextEditingController _name;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Division name is required')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ApiClient().post<dynamic>(
        '/departments/${widget.departmentId}/divisions',
        data: {'name': name},
      );
      if (mounted) {
        Navigator.of(context).pop();
        widget.onAdded();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_apiErrMsg(e))),
        );
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New division'),
      content: TextField(
        controller: _name,
        enabled: !_submitting,
        decoration: const InputDecoration(
          labelText: 'Name',
          border: OutlineInputBorder(),
        ),
        textCapitalization: TextCapitalization.words,
        autofocus: true,
        onSubmitted: _submitting ? null : (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Add'),
        ),
      ],
    );
  }
}
