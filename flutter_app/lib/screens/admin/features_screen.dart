import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/models/user_model.dart';
import 'package:efiling_app/core/utils/responsive.dart';

/// Admin Features – mirrors web /admin/features (simplified).
/// Controls default due-time settings and backfill.
class FeaturesScreen extends StatefulWidget {
  const FeaturesScreen({super.key});

  @override
  State<FeaturesScreen> createState() => _FeaturesScreenState();
}

class _FeaturesScreenState extends State<FeaturesScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;

  bool _enableDefaultDueTime = true;
  final _hoursController = TextEditingController(text: '48');

  bool _isTechPanel(UserModel? u) => u?.hasRole('DEVELOPER') == true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _hoursController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ApiClient().get<dynamic>('/admin/settings');
      final data = res.data;
      final list = data is List ? data : (data is Map && data['data'] is List ? data['data'] as List : []);
      final settings = (list is List ? list : const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();

      final user = context.read<AuthProvider>().user;
      final myDept = user?.departmentId;
      final isSuper = _isTechPanel(user);

      String? sla;
      String? enabled;

      if (isSuper) {
        sla = settings.firstWhere((s) => s['key'] == 'defaultSlaNormHours' && s['departmentId'] == null, orElse: () => {})['value']?.toString();
        enabled = settings.firstWhere((s) => s['key'] == 'ENABLE_DEFAULT_DUE_TIME' && s['departmentId'] == null, orElse: () => {})['value']?.toString();
      } else if (myDept != null) {
        final mySla = settings.firstWhere((s) => s['key'] == 'defaultSlaNormHours' && s['departmentId']?.toString() == myDept, orElse: () => {});
        final globalSla = settings.firstWhere((s) => s['key'] == 'defaultSlaNormHours' && s['departmentId'] == null, orElse: () => {});
        final myEn = settings.firstWhere((s) => s['key'] == 'ENABLE_DEFAULT_DUE_TIME' && s['departmentId']?.toString() == myDept, orElse: () => {});
        final globalEn = settings.firstWhere((s) => s['key'] == 'ENABLE_DEFAULT_DUE_TIME' && s['departmentId'] == null, orElse: () => {});
        sla = (mySla['value'] ?? globalSla['value'])?.toString();
        enabled = (myEn['value'] ?? globalEn['value'])?.toString();
      }

      if (mounted) {
        setState(() {
          if (sla != null && sla.isNotEmpty) _hoursController.text = sla;
          if (enabled != null) {
            final raw = enabled.toLowerCase();
            _enableDefaultDueTime = raw == 'true' || raw == '1' || raw == 'yes';
          }
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString().replaceFirst('DioException: ', ''); });
    }
  }

  Future<void> _save() async {
    final hours = double.tryParse(_hoursController.text.trim());
    if (hours == null || hours <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Default due time must be > 0 hours')));
      return;
    }
    final user = context.read<AuthProvider>().user;
    final isSuper = _isTechPanel(user);
    final myDept = user?.departmentId;

    setState(() => _saving = true);
    try {
      if (isSuper) {
        await Future.wait([
          ApiClient().put('/admin/settings/ENABLE_DEFAULT_DUE_TIME', data: {'value': _enableDefaultDueTime ? 'true' : 'false', 'departmentId': null}),
          ApiClient().put('/admin/settings/defaultSlaNormHours', data: {'value': hours.toString(), 'departmentId': null}),
        ]);
      } else if (myDept != null) {
        await Future.wait([
          ApiClient().put('/admin/settings/ENABLE_DEFAULT_DUE_TIME', data: {'value': _enableDefaultDueTime ? 'true' : 'false', 'departmentId': myDept}),
          ApiClient().put('/admin/settings/defaultSlaNormHours', data: {'value': hours.toString(), 'departmentId': myDept}),
        ]);
      } else {
        await Future.wait([
          ApiClient().put('/admin/settings/ENABLE_DEFAULT_DUE_TIME', data: {'value': _enableDefaultDueTime ? 'true' : 'false'}),
          ApiClient().put('/admin/settings/defaultSlaNormHours', data: {'value': hours.toString()}),
        ]);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Feature settings updated')));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Save failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _backfillDueTimes() async {
    setState(() => _saving = true);
    try {
      await _save();
      final res = await ApiClient().post<dynamic>('/files/backfill-due-times');
      final data = res.data;
      final updated = data is Map ? (data['updated'] ?? 0) : 0;
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Backfilled due times: $updated')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Backfill failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);
    final isTechPanel = _isTechPanel(context.watch<AuthProvider>().user);
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
              Text('Failed to load feature settings', style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(padding.left, 16, padding.right, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Features', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enable default due time'),
                    subtitle: const Text('Auto-assign a due date/time when creating files'),
                    value: _enableDefaultDueTime,
                    onChanged: (_saving || !isTechPanel) ? null : (v) => setState(() => _enableDefaultDueTime = v),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _hoursController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Default due time (hours)',
                      border: OutlineInputBorder(),
                    ),
                    enabled: !_saving && isTechPanel,
                  ),
                  if (!isTechPanel) ...[
                    const SizedBox(height: 8),
                    Text(
                      'View only. Global parameter editing is restricted to Tech Panel.',
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: (_saving || !isTechPanel) ? null : _save,
                    icon: _saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save),
                    label: const Text('Save'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: (_saving || !isTechPanel) ? null : _backfillDueTimes,
                    icon: const Icon(Icons.history),
                    label: const Text('Backfill due times'),
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

