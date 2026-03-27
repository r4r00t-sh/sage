import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/utils/responsive.dart';
import 'package:efiling_app/models/user_model.dart';

class DepartmentsScreen extends StatefulWidget {
  const DepartmentsScreen({super.key});

  @override
  State<DepartmentsScreen> createState() => _DepartmentsScreenState();
}

class _DepartmentsScreenState extends State<DepartmentsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _departments = [];
  bool _accessChecked = false;

  static String errMsg(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && d['message'] is String) return d['message'] as String;
      return e.message ?? e.toString();
    }
    return e.toString().replaceFirst('DioException: ', '');
  }

  List<Map<String, dynamic>> _applyDeptAdminFilter(
    List<Map<String, dynamic>> raw,
    UserModel? user,
  ) {
    if (user == null) return raw;
    if (user.hasAnyRole(['DEPT_ADMIN']) && !user.hasGodRole) {
      final id = user.departmentId;
      if (id != null) {
        return raw.where((d) => d['id']?.toString() == id).toList();
      }
    }
    return raw;
  }

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
        !user.hasAnyRole(['SUPER_ADMIN', 'DEPT_ADMIN', 'DEVELOPER'])) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/dashboard');
      });
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient().get<dynamic>('/departments');
      final data = res.data;
      final raw = data is List
          ? data
          : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      final mapped = list
          .map((e) =>
              e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{})
          .toList();
      final user = context.read<AuthProvider>().user;
      if (mounted) {
        setState(() {
          _departments = _applyDeptAdminFilter(mapped, user);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = errMsg(e);
        });
      }
    }
  }

  Future<void> _showCreateDialog() async {
    final user = context.read<AuthProvider>().user;
    if (user == null || !user.hasGodRole) return;

    await showDialog<void>(
      context: context,
      builder: (ctx) => _CreateDepartmentDialog(
        onCreated: () {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Department created')),
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
              Text('Failed to load departments', style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: EdgeInsets.fromLTRB(padding.left, 16, padding.right, 24),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Departments',
                      style: theme.textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'View departments and divisions',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              if (canManage)
                FilledButton.icon(
                  onPressed: _showCreateDialog,
                  icon: const Icon(Icons.add, size: 20),
                  label: const Text('Add'),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_departments.isEmpty)
            const Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: Text('No departments')),
            )
          else
            ..._departments.map((d) {
              final id = d['id']?.toString() ?? '';
              final name = d['name']?.toString() ?? '—';
              final code = d['code']?.toString() ?? '';
              final org = d['organisation'];
              final orgName = org is Map ? org['name']?.toString() : null;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const Icon(Icons.apartment),
                  title: Text(name),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (code.isNotEmpty) Text(code),
                      if (orgName != null && orgName.isNotEmpty)
                        Text(
                          orgName,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                  isThreeLine: orgName != null && orgName.isNotEmpty,
                  trailing: const Icon(Icons.chevron_right),
                  onTap: id.isEmpty
                      ? null
                      : () => context.push('/admin/departments/$id'),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _CreateDepartmentDialog extends StatefulWidget {
  const _CreateDepartmentDialog({required this.onCreated});

  final VoidCallback onCreated;

  @override
  State<_CreateDepartmentDialog> createState() => _CreateDepartmentDialogState();
}

class _CreateDepartmentDialogState extends State<_CreateDepartmentDialog> {
  late final TextEditingController _name;
  late final TextEditingController _code;
  List<Map<String, dynamic>> _orgs = [];
  String? _orgId;
  String? _loadErr;
  bool _loadingOrgs = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController();
    _code = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadOrgs());
  }

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _loadOrgs() async {
    setState(() {
      _loadingOrgs = true;
      _loadErr = null;
    });
    try {
      final res = await ApiClient().get<dynamic>('/admin/organisations');
      final data = res.data;
      final raw = data is List
          ? data
          : (data is Map && data['data'] != null ? data['data'] as List : []);
      _orgs = (raw is List ? raw : const [])
          .map((e) =>
              e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{})
          .toList();
      if (_orgs.length == 1) {
        _orgId = _orgs.first['id']?.toString();
      }
    } catch (e) {
      _loadErr = DepartmentsScreen.errMsg(e);
    }
    setState(() => _loadingOrgs = false);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New department'),
      content: SingleChildScrollView(
        child: _loadingOrgs && _orgs.isEmpty && _loadErr == null
            ? const SizedBox(
                height: 120,
                child: Center(child: CircularProgressIndicator()),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_loadErr != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _loadErr!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  DropdownButtonFormField<String>(
                    value: _orgId != null &&
                            _orgs.any((o) => o['id']?.toString() == _orgId)
                        ? _orgId
                        : null,
                    decoration: const InputDecoration(
                      labelText: 'Organisation',
                      border: OutlineInputBorder(),
                    ),
                    items: _orgs
                        .map(
                          (o) => DropdownMenuItem(
                            value: o['id']?.toString(),
                            child: Text(o['name']?.toString() ?? '—'),
                          ),
                        )
                        .toList(),
                    onChanged: _submitting
                        ? null
                        : (v) => setState(() => _orgId = v),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _name,
                    enabled: !_submitting,
                    decoration: const InputDecoration(
                      labelText: 'Name',
                      border: OutlineInputBorder(),
                    ),
                    textCapitalization: TextCapitalization.words,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _code,
                    enabled: !_submitting,
                    decoration: const InputDecoration(
                      labelText: 'Code',
                      border: OutlineInputBorder(),
                      hintText: 'Unique short code',
                    ),
                  ),
                ],
              ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: (_loadingOrgs || _orgs.isEmpty || _submitting)
              ? null
              : () async {
                  final name = _name.text.trim();
                  final code = _code.text.trim();
                  if (name.isEmpty || code.isEmpty || _orgId == null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Name, code, and organisation are required'),
                      ),
                    );
                    return;
                  }
                  setState(() => _submitting = true);
                  try {
                    await ApiClient().post<dynamic>(
                      '/departments',
                      data: {
                        'name': name,
                        'code': code,
                        'organisationId': _orgId,
                      },
                    );
                    if (context.mounted) {
                      Navigator.of(context).pop();
                      widget.onCreated();
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(DepartmentsScreen.errMsg(e))),
                      );
                      setState(() => _submitting = false);
                    }
                  }
                },
          child: _submitting
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Create'),
        ),
      ],
    );
  }
}
