import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';

class OpinionsInboxScreen extends StatefulWidget {
  const OpinionsInboxScreen({super.key});

  @override
  State<OpinionsInboxScreen> createState() => _OpinionsInboxScreenState();
}

class _OpinionsInboxScreenState extends State<OpinionsInboxScreen> {
  List<Map<String, dynamic>> _received = [];
  List<Map<String, dynamic>> _sent = [];
  bool _loading = true;
  int _tab = 0; // 0 received, 1 sent

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient().get<dynamic>('/opinions/pending'),
        ApiClient().get<dynamic>('/opinions/sent'),
      ]);
      final recvData = results[0].data;
      final sentData = results[1].data;
      final recvRaw = recvData is List ? recvData : (recvData is Map && recvData['data'] != null ? recvData['data'] as List : []);
      final sentRaw = sentData is List ? sentData : (sentData is Map && sentData['data'] != null ? sentData['data'] as List : []);
      _received = (recvRaw is List ? recvRaw : const []).map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
      _sent = (sentRaw is List ? sentRaw : const []).map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
    } catch (_) {}
    setState(() => _loading = false);
  }

  Widget _emptyState(String text) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.chat_bubble_outline, size: 56, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(text, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(Map<String, dynamic> r) {
    final requestId = r['id']?.toString() ?? r['opinionRequestId']?.toString() ?? '';
    final status = r['status']?.toString() ?? 'pending';
    final reason = r['requestReason']?.toString() ?? '';
    final file = r['file'] is Map ? Map<String, dynamic>.from(r['file'] as Map) : null;
    final fileNumber = file?['fileNumber']?.toString() ?? r['fileId']?.toString() ?? '—';
    final subject = file?['subject']?.toString() ?? '—';
    final requestedBy = r['requestedBy'] is Map ? (r['requestedBy']['name']?.toString() ?? '—') : '—';
    final toDept = r['requestedToDepartment'] is Map ? (r['requestedToDepartment']['code']?.toString() ?? '—') : '—';
    final fromDept = r['requestedFromDepartment'] is Map ? (r['requestedFromDepartment']['code']?.toString() ?? '—') : '—';
    final toDiv = r['requestedToDivision'] is Map ? (r['requestedToDivision']['name']?.toString() ?? 'All divisions') : 'All divisions';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.description_outlined),
        title: Text('$fileNumber • $subject', maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(
          _tab == 0
              ? 'From: $fromDept • By: $requestedBy${reason.isNotEmpty ? ' • $reason' : ''}'
              : 'To: $toDept${toDiv.isNotEmpty ? ' • $toDiv' : ''}${reason.isNotEmpty ? ' • $reason' : ''}',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(status, style: Theme.of(context).textTheme.labelSmall),
            const Icon(Icons.chevron_right),
          ],
        ),
        onTap: () {
          if (requestId.isNotEmpty) context.push('/opinions/$requestId');
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: DefaultTabController(
        length: 2,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text('Opinion Inbox', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            TabBar(
              onTap: (i) => setState(() => _tab = i),
              tabs: const [
                Tab(text: 'Received'),
                Tab(text: 'Sent'),
              ],
            ),
            const SizedBox(height: 12),
            if (_tab == 0) ...[
              if (_received.isEmpty) _emptyState('No received opinion requests')
              else ..._received.map(_buildRow),
            ] else ...[
              if (_sent.isEmpty) _emptyState('No sent opinion requests')
              else ..._sent.map(_buildRow),
            ],
          ],
        ),
      ),
    );
  }
}
