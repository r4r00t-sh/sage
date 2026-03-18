import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart' show FormData, MultipartFile;
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/utils/responsive.dart';

/// Ready for Dispatch – list files and mark for dispatch or open file.
/// Dispatcher sees files prepared for dispatch; can dispatch from file detail.
class DispatchScreen extends StatefulWidget {
  const DispatchScreen({super.key});

  @override
  State<DispatchScreen> createState() => _DispatchScreenState();
}

class _DispatchScreenState extends State<DispatchScreen> {
  List<dynamic> _files = [];
  bool _loading = true;
  String? _error;
  bool _submitting = false;

  // Dispatch modal state
  String? _selectedFileId;
  String? _selectedFileNumber;
  String _dispatchMethod = '';
  final _trackingController = TextEditingController();
  final _recipientNameController = TextEditingController();
  final _recipientAddressController = TextEditingController();
  final _recipientEmailController = TextEditingController();
  final _remarksController = TextEditingController();
  PlatformFile? _proofFile;

  static const _dispatchMethods = [
    {'value': 'post', 'label': 'Post'},
    {'value': 'courier', 'label': 'Courier'},
    {'value': 'hand_delivery', 'label': 'Hand delivery'},
    {'value': 'email', 'label': 'Email'},
    {'value': 'other', 'label': 'Other'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _trackingController.dispose();
    _recipientNameController.dispose();
    _recipientAddressController.dispose();
    _recipientEmailController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Match web: Dispatcher views APPROVED files as "ready for dispatch"
      final res = await ApiClient().get<dynamic>('/files', queryParameters: {'status': 'APPROVED'});
      final data = res.data;
      final raw = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      if (mounted) {
        setState(() {
          _files = list;
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

  Future<void> _pickProof() async {
    final res = await FilePicker.platform.pickFiles(allowMultiple: false, type: FileType.any);
    if (res == null || res.files.isEmpty) return;
    setState(() => _proofFile = res.files.first);
  }

  void _openDispatchModal(Map<String, dynamic> f) {
    setState(() {
      _selectedFileId = f['id']?.toString();
      _selectedFileNumber = f['fileNumber']?.toString();
      _dispatchMethod = '';
      _trackingController.clear();
      _recipientNameController.clear();
      _recipientAddressController.clear();
      _recipientEmailController.clear();
      _remarksController.clear();
      _proofFile = null;
    });
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: _DispatchSheet(
          fileNumber: _selectedFileNumber ?? '—',
          dispatchMethod: _dispatchMethod,
          methods: _dispatchMethods,
          onMethodChanged: (v) => setState(() => _dispatchMethod = v),
          trackingController: _trackingController,
          recipientNameController: _recipientNameController,
          recipientAddressController: _recipientAddressController,
          recipientEmailController: _recipientEmailController,
          remarksController: _remarksController,
          proofFileName: _proofFile?.name,
          onPickProof: _pickProof,
          submitting: _submitting,
          onSubmit: _submitDispatch,
        ),
      ),
    );
  }

  Future<void> _submitDispatch() async {
    if ((_selectedFileId ?? '').isEmpty) return;
    if (_dispatchMethod.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select a dispatch method')));
      return;
    }
    setState(() => _submitting = true);
    try {
      final fd = FormData();
      fd.fields.add(MapEntry('fileId', _selectedFileId!));
      fd.fields.add(MapEntry('dispatchMethod', _dispatchMethod.trim()));
      if (_trackingController.text.trim().isNotEmpty) fd.fields.add(MapEntry('trackingNumber', _trackingController.text.trim()));
      if (_recipientNameController.text.trim().isNotEmpty) fd.fields.add(MapEntry('recipientName', _recipientNameController.text.trim()));
      if (_recipientAddressController.text.trim().isNotEmpty) fd.fields.add(MapEntry('recipientAddress', _recipientAddressController.text.trim()));
      if (_recipientEmailController.text.trim().isNotEmpty) fd.fields.add(MapEntry('recipientEmail', _recipientEmailController.text.trim()));
      if (_remarksController.text.trim().isNotEmpty) fd.fields.add(MapEntry('remarks', _remarksController.text.trim()));
      if (_proofFile != null) {
        final pf = _proofFile!;
        if (pf.bytes != null) {
          fd.files.add(MapEntry('proofDocument', MultipartFile.fromBytes(pf.bytes!, filename: pf.name)));
        } else if (pf.path != null && pf.path!.isNotEmpty) {
          fd.files.add(MapEntry('proofDocument', await MultipartFile.fromFile(pf.path!, filename: pf.name)));
        }
      }
      await ApiClient().dio.post('/dispatch/dispatch', data: fd);
      if (!mounted) return;
      Navigator.of(context).pop(); // close sheet
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('File dispatched successfully')));
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to dispatch: ${e.toString().replaceFirst('DioException: ', '')}')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
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
              Text('Failed to load files', style: theme.textTheme.titleLarge),
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
                  Text('Ready for Dispatch', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('Files approved and waiting to be dispatched', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 8),
                  Text('${_files.length} file(s)', style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/dispatch/history'),
                    icon: const Icon(Icons.history),
                    label: const Text('Dispatch History'),
                  ),
                ],
              ),
            ),
          ),
          if (_files.isEmpty)
            const SliverFillRemaining(
              child: Center(child: Text('No files ready for dispatch')),
            )
          else
            SliverPadding(
              padding: padding,
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final f = _files[i] is Map ? _files[i] as Map<String, dynamic> : <String, dynamic>{};
                    final id = f['id']?.toString() ?? '';
                    final subject = f['subject']?.toString() ?? '—';
                    final fileNumber = f['fileNumber']?.toString() ?? '—';
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: const Icon(Icons.send),
                        title: Text(subject, overflow: TextOverflow.ellipsis),
                        subtitle: Text(fileNumber),
                        trailing: Wrap(
                          spacing: 8,
                          children: [
                            OutlinedButton(
                              onPressed: id.isEmpty ? null : () => context.push('/files/$id'),
                              child: const Text('View'),
                            ),
                            FilledButton(
                              onPressed: id.isEmpty ? null : () => _openDispatchModal(f),
                              child: const Text('Dispatch'),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                  childCount: _files.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DispatchSheet extends StatelessWidget {
  const _DispatchSheet({
    required this.fileNumber,
    required this.dispatchMethod,
    required this.methods,
    required this.onMethodChanged,
    required this.trackingController,
    required this.recipientNameController,
    required this.recipientAddressController,
    required this.recipientEmailController,
    required this.remarksController,
    required this.proofFileName,
    required this.onPickProof,
    required this.submitting,
    required this.onSubmit,
  });

  final String fileNumber;
  final String dispatchMethod;
  final List<Map<String, String>> methods;
  final ValueChanged<String> onMethodChanged;
  final TextEditingController trackingController;
  final TextEditingController recipientNameController;
  final TextEditingController recipientAddressController;
  final TextEditingController recipientEmailController;
  final TextEditingController remarksController;
  final String? proofFileName;
  final VoidCallback onPickProof;
  final bool submitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text('Dispatch', style: theme.textTheme.titleLarge)),
                IconButton(icon: const Icon(Icons.close), onPressed: submitting ? null : () => Navigator.of(context).pop()),
              ],
            ),
            Text('File: $fileNumber', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: dispatchMethod.isEmpty ? null : dispatchMethod,
              decoration: const InputDecoration(labelText: 'Dispatch method', border: OutlineInputBorder()),
              items: methods.map((m) => DropdownMenuItem(value: m['value'], child: Text(m['label']!))).toList(),
              onChanged: submitting ? null : (v) { if (v != null) onMethodChanged(v); },
            ),
            const SizedBox(height: 12),
            TextField(controller: trackingController, decoration: const InputDecoration(labelText: 'Tracking number (optional)', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: recipientNameController, decoration: const InputDecoration(labelText: 'Recipient name (optional)', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: recipientAddressController, decoration: const InputDecoration(labelText: 'Recipient address (optional)', border: OutlineInputBorder()), maxLines: 2),
            const SizedBox(height: 12),
            TextField(controller: recipientEmailController, decoration: const InputDecoration(labelText: 'Recipient email (optional)', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: remarksController, decoration: const InputDecoration(labelText: 'Remarks (optional)', border: OutlineInputBorder()), maxLines: 2),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: submitting ? null : onPickProof,
              icon: const Icon(Icons.upload_file),
              label: Text(proofFileName == null ? 'Upload proof (optional)' : 'Proof: $proofFileName'),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: submitting ? null : onSubmit,
              icon: submitting ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.local_shipping),
              label: Text(submitting ? 'Submitting…' : 'Dispatch file'),
            ),
          ],
        ),
      ),
    );
  }
}
