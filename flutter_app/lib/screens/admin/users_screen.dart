import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  List<dynamic> _users = [];
  bool _loading = true;

  static String _departmentLine(Map<String, dynamic> u) {
    final roles = (u['roles'] as List<dynamic>?)?.cast<String>() ?? [];
    final hasMulti =
        roles.contains('DEPT_ADMIN') || roles.contains('APPROVAL_AUTHORITY');
    if (hasMulti) {
      final ad = u['administeredDepartments'] as List<dynamic>?;
      if (ad != null && ad.isNotEmpty) {
        final parts = ad
            .whereType<Map>()
            .map((e) =>
                e['name']?.toString() ??
                e['code']?.toString() ??
                e['id']?.toString() ??
                '')
            .where((s) => s.isNotEmpty);
        final s = parts.join(', ');
        if (s.isNotEmpty) return s;
      }
    }
    final dept = u['department'] is Map
        ? (u['department'] as Map)['name']?.toString()
        : null;
    if (dept != null && dept.isNotEmpty) return dept;
    return '';
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient().get<dynamic>('/users');
      final data = res.data;
      _users = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return ListView.builder(
      padding: const EdgeInsets.all(24),
      itemCount: _users.length,
      itemBuilder: (context, i) {
        final u = _users[i] as Map<String, dynamic>;
        final name = u['name'] as String? ?? '';
        final username = u['username'] as String? ?? '';
        final roles = (u['roles'] as List<dynamic>?)?.join(', ') ?? u['role']?.toString() ?? '';
        final deptLine = _departmentLine(u);
        final userId = u['id']?.toString() ?? '';
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?')),
            title: Text(name),
            subtitle: Text(
              deptLine.isEmpty ? '$username • $roles' : '$username • $roles\n$deptLine',
            ),
            isThreeLine: deptLine.isNotEmpty,
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              if (userId.isNotEmpty) context.go('/admin/users/$userId');
            },
          ),
        );
      },
    );
  }
}
