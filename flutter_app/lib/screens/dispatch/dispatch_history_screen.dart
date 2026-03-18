import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/api/api_config.dart';
import 'package:efiling_app/core/utils/responsive.dart';

/// Dispatch History – list of dispatch proofs (GET /dispatch/proofs).
class DispatchHistoryScreen extends StatefulWidget {
  const DispatchHistoryScreen({super.key});

  @override
  State<DispatchHistoryScreen> createState() => _DispatchHistoryScreenState();
}

class _DispatchHistoryScreenState extends State<DispatchHistoryScreen> {
  List<dynamic> _proofs = [];
  bool _loading = true;
  String? _error;
  DateTime? _from;
  DateTime? _to;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final qp = <String, dynamic>{};
      if (_from != null) qp['dateFrom'] = DateFormat('yyyy-MM-dd').format(_from!);
      if (_to != null) qp['dateTo'] = DateFormat('yyyy-MM-dd').format(_to!);
      final res = await ApiClient().get<dynamic>('/dispatch/proofs', queryParameters: qp.isEmpty ? null : qp);
      final data = res.data;
      final list = data is List ? data : (data is Map && data['data'] is List ? data['data'] as List : []);
      if (mounted) {
        setState(() {
          _proofs = List<dynamic>.from(list);
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

  Future<void> _pickFrom() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _from ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
    );
    if (d != null) setState(() => _from = d);
    await _load();
  }

  Future<void> _pickTo() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _to ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
    );
    if (d != null) setState(() => _to = d);
    await _load();
  }

  Future<void> _downloadProof(String proofId, String type) async {
    final url = Uri.parse('${ApiConfig.baseUrl}/dispatch/proofs/$proofId/download/$type');
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: padding,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text('Failed to load dispatch history', style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
              const SizedBox(height: 24),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: padding.copyWith(top: 16, bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Dispatch History', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('Past dispatch records', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 8),
                  Text('${_proofs.length} record(s)', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: _pickFrom,
                        icon: const Icon(Icons.calendar_today, size: 18),
                        label: Text(_from == null ? 'From' : 'From: ${DateFormat.yMd().format(_from!)}'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _pickTo,
                        icon: const Icon(Icons.calendar_today, size: 18),
                        label: Text(_to == null ? 'To' : 'To: ${DateFormat.yMd().format(_to!)}'),
                      ),
                      TextButton(
                        onPressed: () async {
                          setState(() { _from = null; _to = null; });
                          await _load();
                        },
                        child: const Text('Clear'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (_proofs.isEmpty)
            const SliverFillRemaining(
              child: Center(child: Text('No dispatch history yet')),
            )
          else
            SliverPadding(
              padding: padding,
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final p = _proofs[i] is Map ? _proofs[i] as Map<String, dynamic> : <String, dynamic>{};
                    final proofId = p['id']?.toString() ?? '';
                    final fileId = p['fileId']?.toString() ?? '';
                    final fileNumber = p['file'] is Map ? (p['file'] as Map)['fileNumber']?.toString() : p['fileNumber']?.toString() ?? '—';
                    final method = p['dispatchMethod']?.toString() ?? '—';
                    final date = p['dispatchDate']?.toString();
                    final by = p['dispatchedBy'] is Map ? (p['dispatchedBy'] as Map)['name']?.toString() : '—';
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: const Icon(Icons.history),
                        title: Text('$fileNumber', style: theme.textTheme.titleSmall),
                        subtitle: Text('$method • $by${date != null ? ' • ${DateFormat.yMd().format(DateTime.tryParse(date) ?? DateTime.now())}' : ''}'),
                        trailing: proofId.isEmpty
                            ? null
                            : PopupMenuButton<String>(
                                onSelected: (v) {
                                  if (v == 'proof') _downloadProof(proofId, 'proof');
                                  if (v == 'ack') _downloadProof(proofId, 'acknowledgement');
                                },
                                itemBuilder: (_) => const [
                                  PopupMenuItem(value: 'proof', child: Text('Download proof')),
                                  PopupMenuItem(value: 'ack', child: Text('Download acknowledgement')),
                                ],
                              ),
                        onTap: fileId.isEmpty ? null : () => GoRouter.of(context).push('/files/$fileId'),
                      ),
                    );
                  },
                  childCount: _proofs.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
