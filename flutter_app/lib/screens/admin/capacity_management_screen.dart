import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/utils/responsive.dart';

/// Capacity Management – mirrors web /admin/capacity.
/// View capacity hierarchy: Department -> Divisions -> Users. Edit user maxFilesPerDay.
class CapacityManagementScreen extends StatefulWidget {
  const CapacityManagementScreen({super.key});

  @override
  State<CapacityManagementScreen> createState() => _CapacityManagementScreenState();
}

class _CapacityManagementScreenState extends State<CapacityManagementScreen> {
  bool _loading = true;
  bool _loadingDepartments = true;
  String? _error;

  List<Map<String, dynamic>> _departments = [];
  String? _selectedDepartmentId;

  Map<String, dynamic>? _capacityData; // department hierarchy response

  @override
  void initState() {
    super.initState();
    _loadDepartments();
  }

  Future<void> _loadDepartments() async {
    setState(() {
      _loadingDepartments = true;
      _error = null;
    });
    try {
      final res = await ApiClient().get<dynamic>('/departments');
      final data = res.data;
      final raw = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      final depts = list.map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();

      final userDept = context.read<AuthProvider>().user?.departmentId;
      final initial = userDept ?? (depts.isNotEmpty ? depts.first['id']?.toString() : null);

      if (mounted) {
        setState(() {
          _departments = depts;
          _selectedDepartmentId = initial;
          _loadingDepartments = false;
        });
      }
      if (initial != null && initial.isNotEmpty) {
        await _loadHierarchy(initial);
      } else {
        if (mounted) setState(() => _loading = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _departments = [];
          _loadingDepartments = false;
          _loading = false;
          _error = e.toString().replaceFirst('DioException: ', '');
        });
      }
    }
  }

  Future<void> _loadHierarchy(String departmentId) async {
    setState(() {
      _loading = true;
      _error = null;
      _capacityData = null;
    });
    try {
      final res = await ApiClient().get<dynamic>('/capacity/department/$departmentId/hierarchy');
      final data = res.data;
      if (mounted) {
        setState(() {
          _capacityData = data is Map ? Map<String, dynamic>.from(data as Map) : null;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString().replaceFirst('DioException: ', '');
        });
      }
    }
  }

  Future<void> _editUserCapacity(Map<String, dynamic> user) async {
    final userId = user['userId']?.toString() ?? user['id']?.toString() ?? '';
    if (userId.isEmpty) return;
    final current = (user['maxFilesPerDay'] is num) ? (user['maxFilesPerDay'] as num).toInt() : 10;
    final controller = TextEditingController(text: current.toString());

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit user capacity'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Files per day', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );

    if (ok != true) return;
    final value = int.tryParse(controller.text.trim());
    if (value == null || value < 1) return;

    try {
      await ApiClient().put('/capacity/user/$userId', data: {'maxFilesPerDay': value});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('User capacity updated')));
      final deptId = _selectedDepartmentId;
      if (deptId != null) await _loadHierarchy(deptId);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update: ${e.toString().replaceFirst('DioException: ', '')}')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);

    return RefreshIndicator(
      onRefresh: () async {
        final deptId = _selectedDepartmentId;
        if (deptId != null && deptId.isNotEmpty) {
          await _loadHierarchy(deptId);
        } else {
          await _loadDepartments();
        }
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(padding.left, 16, padding.right, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Capacity Management', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('Manage file capacity hierarchically: User → Division → Department', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 16),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Department', style: theme.textTheme.labelLarge),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedDepartmentId,
                      decoration: const InputDecoration(border: OutlineInputBorder()),
                      items: _departments
                          .map((d) => DropdownMenuItem(
                                value: d['id']?.toString(),
                                child: Text(d['name']?.toString() ?? '—'),
                              ))
                          .toList(),
                      onChanged: _loadingDepartments
                          ? null
                          : (v) async {
                              setState(() => _selectedDepartmentId = v);
                              if (v != null && v.isNotEmpty) await _loadHierarchy(v);
                            },
                    ),
                    if (_loadingDepartments) ...[
                      const SizedBox(height: 12),
                      const Center(child: SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                    ],
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
            else if (_error != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Icon(Icons.error_outline, size: 40, color: theme.colorScheme.error),
                      const SizedBox(height: 8),
                      Text('Failed to load capacity data', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 6),
                      Text(_error!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
                      const SizedBox(height: 12),
                      FilledButton.icon(onPressed: () => _loadHierarchy(_selectedDepartmentId ?? ''), icon: const Icon(Icons.refresh), label: const Text('Retry')),
                    ],
                  ),
                ),
              )
            else if (_capacityData == null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text('Select a department to view its capacity.', style: theme.textTheme.bodyMedium),
                ),
              )
            else ...[
              _DepartmentSummaryCard(data: _capacityData!),
              const SizedBox(height: 12),
              ...((_capacityData!['divisions'] as List? ?? const [])
                  .whereType<Map>()
                  .map((d) => Map<String, dynamic>.from(d))
                  .map((division) => _DivisionTile(division: division, onEditUser: _editUserCapacity))),
            ],
          ],
        ),
      ),
    );
  }
}

class _DepartmentSummaryCard extends StatelessWidget {
  const _DepartmentSummaryCard({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = data['departmentName']?.toString() ?? 'Department';
    final capacity = (data['calculatedCapacity'] ?? 0).toString();
    final current = (data['currentFileCount'] ?? 0).toString();
    final util = (data['utilizationPercent'] is num) ? (data['utilizationPercent'] as num).toDouble() : 0.0;
    final utilClamped = (util / 100).clamp(0.0, 1.0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                _Kpi(label: 'Calculated capacity', value: capacity),
                _Kpi(label: 'Current files', value: current),
                _Kpi(label: 'Utilization', value: '${util.toStringAsFixed(1)}%'),
              ],
            ),
            const SizedBox(height: 10),
            LinearProgressIndicator(value: utilClamped, minHeight: 8),
          ],
        ),
      ),
    );
  }
}

class _DivisionTile extends StatelessWidget {
  const _DivisionTile({required this.division, required this.onEditUser});
  final Map<String, dynamic> division;
  final Future<void> Function(Map<String, dynamic>) onEditUser;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = division['divisionName']?.toString() ?? 'Division';
    final capacity = (division['calculatedCapacity'] ?? 0).toString();
    final current = (division['currentFileCount'] ?? 0).toString();
    final util = (division['utilizationPercent'] is num) ? (division['utilizationPercent'] as num).toDouble() : 0.0;
    final users = (division['users'] as List? ?? const []).whereType<Map>().map((u) => Map<String, dynamic>.from(u)).toList();

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ExpansionTile(
        title: Text(name, style: theme.textTheme.titleSmall),
        subtitle: Text('$current / $capacity files • ${util.toStringAsFixed(1)}%'),
        children: [
          if (users.isEmpty)
            const Padding(padding: EdgeInsets.all(12), child: Text('No users in this division'))
          else
            ...users.map((u) {
              final userName = u['userName']?.toString() ?? 'User';
              final max = (u['maxFilesPerDay'] ?? 0).toString();
              final cur = (u['currentFileCount'] ?? 0).toString();
              final uUtil = (u['utilizationPercent'] is num) ? (u['utilizationPercent'] as num).toDouble() : 0.0;
              return ListTile(
                leading: const Icon(Icons.person_outline),
                title: Text(userName),
                subtitle: Text('$cur / $max files • ${uUtil.toStringAsFixed(1)}%'),
                trailing: IconButton(
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: () => onEditUser(u),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: 170,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 2),
          Text(value, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

