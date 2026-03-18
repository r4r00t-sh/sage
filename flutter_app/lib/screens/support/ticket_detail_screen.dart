import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/models/user_model.dart';
import 'package:efiling_app/core/utils/responsive.dart';

class TicketDetailScreen extends StatefulWidget {
  const TicketDetailScreen({super.key, required this.ticketId});

  final String ticketId;

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _ticket;
  final _replyController = TextEditingController();
  bool _sending = false;

  bool _isSupport(UserModel? u) => u?.hasAnyRole(['DEVELOPER', 'SUPPORT', 'SUPER_ADMIN']) == true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ApiClient().get<dynamic>('/tickets/${widget.ticketId}');
      final data = res.data;
      if (mounted) setState(() { _ticket = data is Map ? Map<String, dynamic>.from(data as Map) : null; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.toString().replaceFirst('DioException: ', ''); });
    }
  }

  Future<void> _sendReply() async {
    final content = _replyController.text.trim();
    if (content.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ApiClient().post('/tickets/${widget.ticketId}/replies', data: {'content': content});
      _replyController.clear();
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to send: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _setStatus(String status) async {
    setState(() => _sending = true);
    try {
      await ApiClient().post('/tickets/${widget.ticketId}/status', data: {'status': status});
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);
    final user = context.watch<AuthProvider>().user;
    final isSupport = _isSupport(user);

    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null || _ticket == null) {
      return Center(
        child: Padding(
          padding: padding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 12),
              Text('Failed to load ticket', style: theme.textTheme.titleLarge),
              if (_error != null) ...[
                const SizedBox(height: 6),
                Text(_error!, textAlign: TextAlign.center),
              ],
              const SizedBox(height: 12),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
              const SizedBox(height: 8),
              TextButton(onPressed: () => context.go('/support'), child: const Text('Back')),
            ],
          ),
        ),
      );
    }

    final t = _ticket!;
    final number = t['ticketNumber']?.toString() ?? widget.ticketId;
    final subject = t['subject']?.toString() ?? '—';
    final desc = t['description']?.toString() ?? '';
    final status = t['status']?.toString() ?? 'OPEN';
    final replies = (t['replies'] as List? ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: EdgeInsets.fromLTRB(padding.left, 16, padding.right, 24),
        children: [
          Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.go('/support')),
              const SizedBox(width: 8),
              Expanded(child: Text(number, style: theme.textTheme.titleLarge?.copyWith(fontFamily: 'monospace'))),
            ],
          ),
          Text(subject, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text('Status: $status', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 12),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Text(desc.isEmpty ? '—' : desc))),
          const SizedBox(height: 12),
          if (isSupport) ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton(onPressed: _sending ? null : () => _setStatus('IN_PROGRESS'), child: const Text('In progress')),
                OutlinedButton(onPressed: _sending ? null : () => _setStatus('WAITING_USER'), child: const Text('Waiting user')),
                OutlinedButton(onPressed: _sending ? null : () => _setStatus('RESOLVED'), child: const Text('Resolved')),
                OutlinedButton(onPressed: _sending ? null : () => _setStatus('CLOSED'), child: const Text('Closed')),
              ],
            ),
            const SizedBox(height: 12),
          ],
          Text('Replies', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          if (replies.isEmpty)
            Text('No replies yet.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))
          else
            ...replies.map((r) {
              final content = r['content']?.toString() ?? '';
              final createdAt = r['createdAt']?.toString() ?? '';
              final u = r['user'] is Map ? Map<String, dynamic>.from(r['user'] as Map) : null;
              final name = u?['name']?.toString() ?? '—';
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
                          if (createdAt.isNotEmpty) Text(createdAt.substring(0, createdAt.length.clamp(0, 19)), style: theme.textTheme.labelSmall),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(content),
                    ],
                  ),
                ),
              );
            }),
          const SizedBox(height: 12),
          TextField(
            controller: _replyController,
            decoration: const InputDecoration(labelText: 'Reply', border: OutlineInputBorder()),
            maxLines: 3,
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _sending ? null : _sendReply,
            icon: _sending ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send),
            label: const Text('Send reply'),
          ),
        ],
      ),
    );
  }
}

