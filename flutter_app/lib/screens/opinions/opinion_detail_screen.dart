import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';

/// Opinion request detail: file info, notes, provide/return (mirrors web opinion detail).
class OpinionDetailScreen extends StatefulWidget {
  const OpinionDetailScreen({super.key, required this.opinionRequestId});

  final String opinionRequestId;

  @override
  State<OpinionDetailScreen> createState() => _OpinionDetailScreenState();
}

class _OpinionDetailScreenState extends State<OpinionDetailScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  final _noteController = TextEditingController();
  final _opinionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _noteController.dispose();
    _opinionController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient().get<dynamic>('/opinions/requests/${widget.opinionRequestId}/file');
      if (mounted) {
        setState(() {
          _data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : null;
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

  Future<void> _addNote() async {
    final content = _noteController.text.trim();
    if (content.isEmpty) return;
    try {
      await ApiClient().post<dynamic>(
        '/opinions/requests/${widget.opinionRequestId}/notes',
        data: {'content': content},
      );
      _noteController.clear();
      _load();
    } catch (_) {}
  }

  Future<void> _provideOpinion() async {
    final note = _opinionController.text.trim();
    try {
      await ApiClient().post<dynamic>(
        '/opinions/requests/${widget.opinionRequestId}/provide',
        data: {'opinionNote': note},
      );
      if (mounted) context.go('/opinions/inbox');
    } catch (_) {}
  }

  Future<void> _returnOpinion() async {
    try {
      await ApiClient().post<dynamic>('/opinions/requests/${widget.opinionRequestId}/return');
      if (mounted) context.go('/opinions/inbox');
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_loading && _data == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null && _data == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Opinion')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
                const SizedBox(height: 16),
                Text('Failed to load opinion request', style: theme.textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(_error!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
                const SizedBox(height: 24),
                FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
                const SizedBox(height: 8),
                TextButton(onPressed: () => context.go('/opinions/inbox'), child: const Text('Back to Inbox')),
              ],
            ),
          ),
        ),
      );
    }

    final data = _data!;
    final file = data['file'] is Map ? Map<String, dynamic>.from(data['file'] as Map) : <String, dynamic>{};
    final req = data['opinionRequest'] is Map ? Map<String, dynamic>.from(data['opinionRequest'] as Map) : <String, dynamic>{};
    final fileNumber = file['fileNumber']?.toString() ?? '—';
    final subject = file['subject']?.toString() ?? '—';
    final description = file['description']?.toString();
    final requestedBy = req['requestedBy'] is Map ? (req['requestedBy']['name']?.toString() ?? '—') : '—';
    final fromDept = req['requestedFromDepartment'] is Map ? (req['requestedFromDepartment']['code']?.toString() ?? '—') : '—';
    final reason = req['requestReason']?.toString() ?? '—';
    final special = req['specialPermissionGranted'] == true;
    final opinionNotes = file['opinionNotes'] is List ? (file['opinionNotes'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : <Map<String, dynamic>>[];

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/opinions/inbox'),
        ),
        title: const Text('Opinion request'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('File', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 8),
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.description),
                        title: Text(fileNumber),
                        subtitle: Text(subject),
                        trailing: Icon(special ? Icons.lock_open : Icons.lock_outline, color: theme.colorScheme.onSurfaceVariant),
                      ),
                      const Divider(),
                      Wrap(
                        spacing: 16,
                        runSpacing: 8,
                        children: [
                          _Meta(label: 'Requested by', value: requestedBy),
                          _Meta(label: 'From dept', value: fromDept),
                          _Meta(label: 'Reason', value: reason),
                          _Meta(label: 'Access', value: special ? 'Full' : 'Limited'),
                        ],
                      ),
                      if (description != null && description.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(description, style: theme.textTheme.bodyMedium),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              if (opinionNotes.isNotEmpty) ...[
                Text('Opinion notes', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                ...opinionNotes.map((n) {
                  final content = n['content']?.toString() ?? '';
                  final user = n['user'] is Map ? Map<String, dynamic>.from(n['user'] as Map) : null;
                  final name = user?['name']?.toString() ?? '—';
                  final createdAt = n['createdAt']?.toString() ?? '';
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(radius: 12, child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?')),
                              const SizedBox(width: 8),
                              Expanded(child: Text(name, style: theme.textTheme.labelLarge)),
                              if (createdAt.isNotEmpty) Text(createdAt.length > 19 ? createdAt.substring(0, 19) : createdAt, style: theme.textTheme.labelSmall),
                            ],
                          ),
                          if (content.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(content),
                          ],
                        ],
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 16),
              ],
              Text('Add note', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _noteController,
                      decoration: const InputDecoration(
                        hintText: 'Note…',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 2,
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(onPressed: _addNote, child: const Text('Add')),
                ],
              ),
              const SizedBox(height: 24),
              Text('Opinion response', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              TextField(
                controller: _opinionController,
                decoration: const InputDecoration(
                  hintText: 'Your opinion note…',
                  border: OutlineInputBorder(),
                ),
                maxLines: 4,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  FilledButton.icon(
                    onPressed: () {
                      if (_opinionController.text.trim().isEmpty) return;
                      _provideOpinion();
                    },
                    icon: const Icon(Icons.check),
                    label: const Text('Submit opinion'),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: _returnOpinion,
                    icon: const Icon(Icons.reply),
                    label: const Text('Return'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: 180,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 2),
          Text(value, style: theme.textTheme.bodyMedium),
        ],
      ),
    );
  }
}
