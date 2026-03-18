import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/models/user_model.dart';
import 'package:efiling_app/core/utils/responsive.dart';

class TicketsListScreen extends StatefulWidget {
  const TicketsListScreen({super.key});

  @override
  State<TicketsListScreen> createState() => _TicketsListScreenState();
}

class _TicketsListScreenState extends State<TicketsListScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _tickets = [];
  bool _supportView = false;

  bool _isSupport(UserModel? u) => u?.hasAnyRole(['DEVELOPER', 'SUPPORT', 'SUPER_ADMIN']) == true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<AuthProvider>().user;
      _supportView = _isSupport(user);
      _load();
    });
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final user = context.read<AuthProvider>().user;
      final isSupport = _isSupport(user);
      final qp = <String, dynamic>{};
      if (_supportView && isSupport) qp['supportView'] = 'true';
      final res = await ApiClient().get<dynamic>('/tickets', queryParameters: qp.isEmpty ? null : qp);
      final data = res.data;
      final list = data is List ? data : (data is Map && data['data'] is List ? data['data'] as List : []);
      _tickets = (list is List ? list : const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString().replaceFirst('DioException: ', ''); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);
    final user = context.watch<AuthProvider>().user;
    final isSupport = _isSupport(user);

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
              Text('Failed to load tickets', style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
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
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_supportView && isSupport ? 'Support Panel' : 'My Tickets', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(
                      _supportView && isSupport ? 'View and respond to all support tickets.' : 'Track your support requests and replies.',
                      style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: () => context.push('/support/new'),
                icon: const Icon(Icons.add),
                label: const Text('New'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (isSupport)
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, label: Text('My tickets')),
                ButtonSegment(value: true, label: Text('All tickets')),
              ],
              selected: {_supportView},
              onSelectionChanged: (s) {
                setState(() => _supportView = s.first);
                _load();
              },
            ),
          const SizedBox(height: 12),
          if (_tickets.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Icon(Icons.support_agent, size: 48, color: theme.colorScheme.onSurfaceVariant),
                    const SizedBox(height: 12),
                    Text('No tickets yet', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 6),
                    Text('Create a ticket to get help.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    const SizedBox(height: 12),
                    FilledButton.icon(onPressed: () => context.push('/support/new'), icon: const Icon(Icons.add), label: const Text('Create ticket')),
                  ],
                ),
              ),
            )
          else
            ..._tickets.map((t) {
              final id = t['id']?.toString() ?? '';
              final number = t['ticketNumber']?.toString() ?? id;
              final subject = t['subject']?.toString() ?? '—';
              final status = t['status']?.toString() ?? 'OPEN';
              final createdAt = t['createdAt']?.toString() ?? '';
              final createdBy = t['createdBy'] is Map ? (t['createdBy']['name']?.toString() ?? '') : '';
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const Icon(Icons.support_agent_outlined),
                  title: Text('$number — $subject', maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text([if (createdBy.isNotEmpty) createdBy, if (createdAt.isNotEmpty) createdAt.substring(0, createdAt.length.clamp(0, 19))].join(' • ')),
                  trailing: Text(status, style: theme.textTheme.labelSmall),
                  onTap: id.isEmpty ? null : () => context.push('/support/$id'),
                ),
              );
            }),
        ],
      ),
    );
  }
}

