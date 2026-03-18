import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/theme/app_colors.dart';
import 'package:efiling_app/core/theme/app_spacing.dart';
import 'package:efiling_app/core/utils/responsive.dart';
import 'package:efiling_app/core/widgets/skeleton_loader.dart';
import 'package:efiling_app/models/file_model.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key, this.initialStatus, this.initialRedlisted = false});

  final String? initialStatus;
  final bool initialRedlisted;

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  List<FileModel> _files = [];
  List<FileModel> _all = [];
  bool _loading = true;
  String? _loadError;
  String _statusFilter = 'all';
  String _priorityFilter = 'all';
  String _search = '';
  bool _redlistedOnly = false;
  /// Selection mode: entered by long-press; when true, checkboxes appear and bottom action bar shows.
  bool _selectionMode = false;
  final Set<String> _selectedIds = {};
  bool _showExportDialog = false;

  // Forward queue (matches web /files/queue)
  bool _queueLoading = false;
  List<Map<String, dynamic>> _queueEntries = [];
  String? _claimingId;

  @override
  void initState() {
    super.initState();
    if (widget.initialStatus != null && widget.initialStatus!.isNotEmpty) {
      _statusFilter = widget.initialStatus!;
    }
    _redlistedOnly = widget.initialRedlisted;
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _loadError = null; });
    try {
      final res = await ApiClient().get<dynamic>('/files');
      final data = res.data;
      final raw = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      _all = list.map((e) => FileModel.fromJson(e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{})).toList();
      _applyFilters();
      await _loadQueue();
      if (mounted) setState(() { _loading = false; _loadError = null; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _loadError = 'Couldn\'t load files.'; });
    }
  }

  Future<void> _loadQueue() async {
    setState(() => _queueLoading = true);
    try {
      final res = await ApiClient().get<dynamic>('/files/queue');
      final data = res.data;
      final raw = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      _queueEntries = list.map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
    } catch (_) {
      _queueEntries = [];
    } finally {
      if (mounted) setState(() => _queueLoading = false);
    }
  }

  Future<void> _claimFromQueue(String fileId) async {
    setState(() => _claimingId = fileId);
    try {
      await ApiClient().post('/files/queue/$fileId/claim');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('File moved to your inbox')));
      await _load();
      if (!mounted) return;
      context.push('/files/$fileId');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to claim file')));
      }
    } finally {
      if (mounted) setState(() => _claimingId = null);
    }
  }

  void _applyFilters() {
    var list = List<FileModel>.from(_all);
    if (_redlistedOnly) list = list.where((f) => f.isRedListed).toList();
    if (_statusFilter != 'all') list = list.where((f) => f.status == _statusFilter).toList();
    if (_priorityFilter != 'all') list = list.where((f) => f.priority == _priorityFilter).toList();
    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      list = list.where((f) => f.fileNumber.toLowerCase().contains(q) || f.subject.toLowerCase().contains(q)).toList();
    }
    _files = list;
  }

  void _toggleSelection(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
    });
  }

  void _selectAll() {
    setState(() {
      for (final f in _files) _selectedIds.add(f.id);
    });
  }

  void _deselectAll() {
    setState(() => _selectedIds.clear());
  }

  void _exitSelectionMode() {
    setState(() {
      _selectionMode = false;
      _selectedIds.clear();
    });
  }

  void _enterSelectionMode(String firstId) {
    setState(() {
      _selectionMode = true;
      _selectedIds.clear();
      _selectedIds.add(firstId);
    });
  }

  void _exportSelected() {
    if (_selectedIds.isEmpty) return;
    setState(() => _showExportDialog = true);
  }

  void _doExportCsv() {
    final selected = _files.where((f) => _selectedIds.contains(f.id)).toList();
    if (selected.isEmpty) return;
    final sb = StringBuffer();
    sb.writeln('fileNumber,subject,status,priority,department,createdAt');
    for (final f in selected) {
      sb.writeln('"${f.fileNumber}","${f.subject.replaceAll('"', '""')}",${f.status},${f.priority},"${f.departmentName}",${f.createdAt?.toIso8601String() ?? ""}');
    }
    final csv = sb.toString();
    Clipboard.setData(ClipboardData(text: csv));
    setState(() => _showExportDialog = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Copied ${selected.length} file(s) as CSV to clipboard. Paste into a spreadsheet to save.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);
    if (_loading) return const ListSkeleton(itemCount: 6);
    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.cloud_off_outlined, size: 48, color: theme.colorScheme.onSurfaceVariant),
              const SizedBox(height: AppSpacing.sm),
              Text(_loadError!, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Pull down to refresh or check your connection.',
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
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
    final total = _all.length;
    final pending = _all.where((f) => f.status == 'PENDING').length;
    final inProgress = _all.where((f) => f.status == 'IN_PROGRESS').length;
    final redListed = _all.where((f) => f.isRedListed).length;
    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: _load,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(padding.left, padding.top, padding.right, _selectionMode ? 100 : padding.bottom),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Forward queue (shows files sent when receiver at capacity)
                if (_queueLoading || _queueEntries.isNotEmpty) ...[
                  Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.list_alt, size: 20),
                              const SizedBox(width: 8),
                              Expanded(child: Text('Forward queue', style: theme.textTheme.titleSmall)),
                              if (_queueLoading)
                                const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                              else
                                Text('${_queueEntries.length} waiting', style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Files sent to you while your desk was at capacity. Claim any file to move it into your inbox.',
                            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                          ),
                          const SizedBox(height: 8),
                          if (!_queueLoading && _queueEntries.isEmpty)
                            Text('No files in your queue.', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant))
                          else if (!_queueLoading)
                            ..._queueEntries.take(5).map((entry) {
                              final file = entry['file'] is Map ? Map<String, dynamic>.from(entry['file'] as Map) : null;
                              final fileId = (entry['fileId'] ?? file?['id'])?.toString() ?? '';
                              final fileNumber = file?['fileNumber']?.toString() ?? '—';
                              final subject = file?['subject']?.toString() ?? '—';
                              final claiming = _claimingId == fileId;
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(fileNumber, style: theme.textTheme.labelLarge?.copyWith(fontFamily: 'monospace')),
                                subtitle: Text(subject, maxLines: 1, overflow: TextOverflow.ellipsis),
                                trailing: FilledButton(
                                  onPressed: (fileId.isEmpty || claiming) ? null : () => _claimFromQueue(fileId),
                                  child: claiming
                                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                      : const Text('Claim'),
                                ),
                              );
                            }),
                          if (!_queueLoading && _queueEntries.length > 5)
                            Text('+ ${_queueEntries.length - 5} more…', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                  ),
                ],
                Row(
                  children: [
                    Expanded(
                      child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search by file number or subject...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
                isDense: true,
              ),
                        onChanged: (v) {
                          setState(() {
                            _search = v;
                            _applyFilters();
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      icon: const Icon(Icons.add),
                      label: Text(Responsive.isWide(context) ? 'New File' : 'New'),
                      onPressed: () => context.push('/files/new'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _StatChip(label: 'Total', value: '$total', onTap: () => setState(() { _statusFilter = 'all'; _redlistedOnly = false; _applyFilters(); })),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Pending', value: '$pending', onTap: () => setState(() { _statusFilter = 'PENDING'; _redlistedOnly = false; _applyFilters(); })),
                  const SizedBox(width: 8),
                  _StatChip(label: 'In progress', value: '$inProgress', onTap: () => setState(() { _statusFilter = 'IN_PROGRESS'; _redlistedOnly = false; _applyFilters(); })),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Red listed', value: '$redListed', onTap: () => setState(() { _statusFilter = 'all'; _redlistedOnly = true; _applyFilters(); })),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _statusFilter,
                    decoration: const InputDecoration(labelText: 'Status', border: OutlineInputBorder(), isDense: true),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('All status')),
                      DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
                      DropdownMenuItem(value: 'IN_PROGRESS', child: Text('In Progress')),
                      DropdownMenuItem(value: 'APPROVED', child: Text('Approved')),
                      DropdownMenuItem(value: 'REJECTED', child: Text('Rejected')),
                      DropdownMenuItem(value: 'ON_HOLD', child: Text('On Hold')),
                    ],
                    onChanged: (v) {
                      setState(() {
                        _statusFilter = v ?? 'all';
                        _applyFilters();
                      });
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _priorityFilter,
                    decoration: const InputDecoration(labelText: 'Priority', border: OutlineInputBorder(), isDense: true),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('All priority')),
                      DropdownMenuItem(value: 'LOW', child: Text('Low')),
                      DropdownMenuItem(value: 'NORMAL', child: Text('Normal')),
                      DropdownMenuItem(value: 'HIGH', child: Text('High')),
                      DropdownMenuItem(value: 'URGENT', child: Text('Urgent')),
                    ],
                    onChanged: (v) {
                      setState(() {
                        _priorityFilter = v ?? 'all';
                        _applyFilters();
                      });
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text('${_files.length} file(s)', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 8),
            if (_files.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(48),
                  child: Column(
                    children: [
                      Icon(Icons.inbox_outlined, size: 64, color: theme.colorScheme.onSurfaceVariant),
                      const SizedBox(height: 16),
                      Text('No files match your filters', style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              )
            else
              ..._files.map((f) {
                final inSelectionMode = _selectionMode;
                final selected = _selectedIds.contains(f.id);
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: inSelectionMode
                        ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Checkbox(
                                value: selected,
                                onChanged: (_) => _toggleSelection(f.id),
                              ),
                              Container(
                                width: 8,
                                height: 8,
                                margin: const EdgeInsets.only(left: 4),
                                decoration: BoxDecoration(
                                  color: f.priority == 'URGENT' ? AppColors.red : (f.priority == 'HIGH' ? AppColors.amber : AppColors.blue),
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          )
                        : Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(left: 4),
                            decoration: BoxDecoration(
                              color: f.priority == 'URGENT' ? AppColors.red : (f.priority == 'HIGH' ? AppColors.amber : AppColors.blue),
                              shape: BoxShape.circle,
                            ),
                          ),
                    title: Row(
                      children: [
                        Expanded(child: Text(f.subject, overflow: TextOverflow.ellipsis)),
                        if (f.isRedListed) Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: AppColors.red.withOpacity( 0.2), borderRadius: BorderRadius.circular(4)), child: Text('RED', style: theme.textTheme.labelSmall?.copyWith(color: AppColors.red))),
                      ],
                    ),
                    subtitle: Text('${f.fileNumber} • ${f.departmentName} • ${f.status}'),
                    trailing: inSelectionMode
                        ? null
                        : PopupMenuButton<String>(
                            tooltip: 'Actions',
                            onSelected: (value) {
                              switch (value) {
                                case 'view':
                                  context.push('/files/${f.id}');
                                  break;
                                case 'forward':
                                  context.push('/files/${f.id}?action=forward');
                                  break;
                                case 'track':
                                  context.push('/files/track/${f.id}');
                                  break;
                              }
                            },
                            itemBuilder: (context) => const [
                              PopupMenuItem(value: 'view', child: ListTile(leading: Icon(Icons.visibility_outlined), title: Text('View details'))),
                              PopupMenuItem(value: 'forward', child: ListTile(leading: Icon(Icons.send_outlined), title: Text('Forward file'))),
                              PopupMenuItem(value: 'track', child: ListTile(leading: Icon(Icons.location_on_outlined), title: Text('Track file'))),
                            ],
                          ),
                    onTap: () {
                      if (inSelectionMode) {
                        _toggleSelection(f.id);
                      } else {
                        context.push('/files/${f.id}');
                      }
                    },
                    onLongPress: () {
                      if (!inSelectionMode) _enterSelectionMode(f.id);
                    },
                  ),
                );
              }).toList(),
          ],
        ),
      ),
    ),
        if (_showExportDialog) _ExportDialog(
          selectedCount: _selectedIds.length,
          onExport: _doExportCsv,
          onCancel: () => setState(() => _showExportDialog = false),
        ),
        if (_selectionMode) _FloatingBulkActionBar(
          selectedCount: _selectedIds.length,
          onClose: _exitSelectionMode,
          onSelectAll: _selectAll,
          onDeselectAll: _deselectAll,
          onExport: _exportSelected,
        ),
      ],
    );
  }
}

/// Floating bulk action bar at bottom – vertical layout for mobile UX (thumb-friendly).
class _FloatingBulkActionBar extends StatelessWidget {
  const _FloatingBulkActionBar({
    required this.selectedCount,
    required this.onClose,
    required this.onSelectAll,
    required this.onDeselectAll,
    required this.onExport,
  });

  final int selectedCount;
  final VoidCallback onClose;
  final VoidCallback onSelectAll;
  final VoidCallback onDeselectAll;
  final VoidCallback onExport;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Positioned(
      left: 16,
      right: 16,
      bottom: 24,
      child: Material(
        elevation: 8,
        shadowColor: theme.colorScheme.shadow.withOpacity( 0.25),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: theme.colorScheme.outline.withOpacity( 0.3)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: onClose,
                    tooltip: 'Cancel selection',
                    style: IconButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.all(8),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$selectedCount file${selectedCount == 1 ? '' : 's'} selected',
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              const Divider(height: 1),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: onSelectAll, child: const Text('Select all'))),
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton(onPressed: onDeselectAll, child: const Text('Deselect all'))),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.tonalIcon(
                  icon: const Icon(Icons.download, size: 20),
                  label: const Text('Export CSV'),
                  onPressed: selectedCount > 0 ? onExport : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExportDialog extends StatelessWidget {
  final int selectedCount;
  final VoidCallback onExport;
  final VoidCallback onCancel;

  const _ExportDialog({required this.selectedCount, required this.onExport, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.black54,
      child: Center(
        child: Card(
          margin: const EdgeInsets.all(24),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Export files', style: theme.textTheme.titleLarge),
                const SizedBox(height: 8),
                Text('Export $selectedCount selected file(s) as CSV.', style: theme.textTheme.bodyMedium),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(onPressed: onCancel, child: const Text('Cancel')),
                    const SizedBox(width: 8),
                    FilledButton.icon(icon: const Icon(Icons.download), label: const Text('Export CSV'), onPressed: onExport),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback? onTap;

  const _StatChip({required this.label, required this.value, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: theme.textTheme.labelSmall),
            Text(value, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}
