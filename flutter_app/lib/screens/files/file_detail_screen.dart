import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart' show FormData, MultipartFile;
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/api/api_config.dart';
import 'package:efiling_app/core/utils/responsive.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/theme/app_colors.dart';
import 'package:efiling_app/core/widgets/file_timer_widget.dart';
import 'package:efiling_app/models/file_model.dart';
import 'package:efiling_app/models/user_model.dart';

class FileDetailScreen extends StatefulWidget {
  const FileDetailScreen({super.key, required this.fileId, this.openForwardOnStart = false});

  final String fileId;
  final bool openForwardOnStart;

  @override
  State<FileDetailScreen> createState() => _FileDetailScreenState();
}

class _FileDetailScreenState extends State<FileDetailScreen> with SingleTickerProviderStateMixin {
  FileModel? _file;
  bool _loading = true;
  String? _error;
  int _notesHistoryTab = 0;
  late TabController _notesTabController;
  int _attachmentIndex = 0;
  bool _uploading = false;
  bool _showForward = false;
  bool _showRecall = false;
  String? _actionType;
  final _remarksController = TextEditingController();
  int _extraDays = 1;
  String? _forwardDivisionId;
  String? _forwardUserId;
  final _forwardRemarksController = TextEditingController();
  // Forwarding parity (web-like): internal/external, single/multiple, department selection (for admins/dispatcher)
  String _forwardType = 'internal'; // internal | external
  String _forwardMode = 'single'; // single | multiple (external only)
  String? _forwardDepartmentId;
  List<Map<String, dynamic>> _departments = [];
  bool _loadingDepartments = false;
  // External divisions/users (optional)
  List<Map<String, dynamic>>? _extDivisions;
  List<Map<String, dynamic>>? _extUsers;
  bool _loadingExtDivisions = false;
  bool _loadingExtUsers = false;
  // Multi-department recipients: {departmentId, departmentName, note}
  List<Map<String, dynamic>> _multiRecipients = [];
  final _recallRemarksController = TextEditingController();
  List<Map<String, dynamic>>? _divisions;
  List<Map<String, dynamic>>? _divisionUsers;
  bool _loadingDivisions = false;
  bool _loadingUsers = false;
  bool _forwarding = false;
  bool _recalling = false;
  bool _actionLoading = false;
  // File QR code
  Map<String, dynamic>? _qrCode;
  bool _loadingQr = false;
  List<Map<String, dynamic>> _scanHistory = [];
  bool _loadingScanHistory = false;
  bool _pendingOpenForward = false;

  @override
  void initState() {
    super.initState();
    _pendingOpenForward = widget.openForwardOnStart;
    _notesTabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _notesTabController.dispose();
    _remarksController.dispose();
    _forwardRemarksController.dispose();
    _recallRemarksController.dispose();
    super.dispose();
  }

  Future<void> _generateQrCode() async {
    setState(() => _loadingQr = true);
    try {
      final res = await ApiClient().post<Map<String, dynamic>>('/documents/files/${widget.fileId}/qrcode');
      if (mounted && res.data != null) setState(() {
        _qrCode = res.data;
        _loadingQr = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingQr = false);
    }
  }

  Future<void> _loadScanHistory() async {
    setState(() => _loadingScanHistory = true);
    try {
      final res = await ApiClient().get<dynamic>('/documents/files/${widget.fileId}/scan-history');
      final data = res.data;
      final list = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : data is Map && data['scans'] != null ? data['scans'] as List : []);
      if (mounted) setState(() {
        _scanHistory = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loadingScanHistory = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _scanHistory = [];
        _loadingScanHistory = false;
      });
    }
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient().get<Map<String, dynamic>>('/files/${widget.fileId}');
      final data = res.data;
      if (mounted && data != null) {
        setState(() {
          _file = FileModel.fromJson(data);
          _loading = false;
        });
        // If navigated here with action=forward, open the forward sheet once after load.
        if (_pendingOpenForward && mounted) {
          _pendingOpenForward = false;
          final f = _file;
          if (f != null && _canEdit(f)) {
            setState(() {
              _showForward = true;
              _forwardDivisionId = null;
              _forwardUserId = null;
            });
            _loadDivisions();
          }
        }
      } else if (mounted) {
        setState(() => _loading = false);
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

  bool _canEdit(FileModel f) {
    final auth = context.read<AuthProvider>();
    final userId = auth.user?.id ?? '';
    final isAssignee = f.assignedToId == userId;
    final isCreator = f.createdById == userId;
    final isUnassigned = f.assignedToId == null || f.assignedToId!.isEmpty;
    final roles = auth.user?.roles ?? [];
    final isTechPanel = roles.contains('DEVELOPER') || roles.contains('SUPER_ADMIN');
    return isAssignee || (isCreator && isUnassigned) || isTechPanel;
  }

  bool _canRecall(FileModel f) {
    final roles = context.read<AuthProvider>().user?.roles ?? [];
    return roles.contains('DEVELOPER') || roles.contains('SUPER_ADMIN');
  }

  List<Map<String, dynamic>> _displayAttachments(FileModel f) {
    if (f.attachments.isNotEmpty) return f.attachments;
    if (f.s3Key != null && f.fileUrl != null) {
      return [
        {
          'id': 'legacy',
          'filename': 'Document',
          'mimeType': 'application/pdf',
          'size': 0,
          'url': f.fileUrl,
        }
      ];
    }
    return [];
  }

  String _attachmentFullUrl(String path) {
    if (path.isEmpty) return '';
    return ApiConfig.attachmentUrl(path);
  }

  Future<void> _uploadAttachments() async {
    final result = await FilePicker.platform.pickFiles(allowMultiple: true, type: FileType.any);
    if (result == null || result.files.isEmpty || _file == null) return;
    setState(() => _uploading = true);
    try {
      final formData = FormData();
      for (final pf in result.files) {
        if (pf.bytes != null) {
          formData.files.add(MapEntry('files', MultipartFile.fromBytes(pf.bytes!, filename: pf.name)));
        } else if (pf.path != null) {
          final mf = await MultipartFile.fromFile(pf.path!, filename: pf.name);
          formData.files.add(MapEntry('files', mf));
        }
      }
      await ApiClient().dio.post('/files/${widget.fileId}/attachments', data: formData);
      await _load();
    } catch (_) {}
    if (mounted) setState(() => _uploading = false);
  }

  Future<void> _addNote(String content) async {
    if (content.trim().isEmpty || _file == null) return;
    try {
      await ApiClient().post('/files/${widget.fileId}/notes', data: {'content': content.trim()});
      await _load();
    } catch (_) {}
  }

  Future<void> _performAction() async {
    if (_actionType == null || _file == null) return;
    final remarks = _remarksController.text.trim();
    if ((_actionType == 'reject' || _actionType == 'return' || _actionType == 'hold' || _actionType == 'recall') && remarks.isEmpty) return;
    setState(() => _actionLoading = true);
    try {
      if (_actionType == 'extra_time') {
        await ApiClient().post('/files/${widget.fileId}/request-extra-time', data: {'additionalDays': _extraDays, 'reason': remarks});
      } else if (_actionType == 'recall') {
        await ApiClient().post('/files/${widget.fileId}/recall', data: {'remarks': remarks});
      } else {
        await ApiClient().post('/files/${widget.fileId}/action', data: {'action': _actionType, 'remarks': remarks});
      }
      if (mounted) {
        setState(() {
          _actionType = null;
          _remarksController.clear();
          _actionLoading = false;
        });
        await _load();
      }
    } catch (_) {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  bool _canForwardExternally(UserModel? user) {
    final isDispatcher = user?.hasRole('DISPATCHER') == true;
    final isAdmin = user?.hasAnyRole(['DEPT_ADMIN', 'SUPER_ADMIN']) == true;
    return isDispatcher || isAdmin;
  }

  Future<void> _loadDepartments() async {
    setState(() => _loadingDepartments = true);
    try {
      final res = await ApiClient().get<dynamic>('/departments');
      final data = res.data;
      final raw = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      if (mounted) setState(() {
        _departments = list.map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
        _loadingDepartments = false;
      });
    } catch (_) {
      if (mounted) setState(() { _departments = []; _loadingDepartments = false; });
    }
  }

  Future<void> _loadExternalDivisions(String deptId) async {
    if (deptId.isEmpty) return;
    setState(() {
      _loadingExtDivisions = true;
      _extDivisions = null;
      _forwardDivisionId = null;
      _forwardUserId = null;
      _extUsers = null;
    });
    try {
      final res = await ApiClient().get<dynamic>('/departments/$deptId/divisions');
      final data = res.data;
      final raw = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      if (mounted) setState(() {
        _extDivisions = list.map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
        _loadingExtDivisions = false;
      });
    } catch (_) {
      if (mounted) setState(() { _extDivisions = []; _loadingExtDivisions = false; });
    }
  }

  Future<void> _loadExternalUsers(String deptId, String divId) async {
    if (deptId.isEmpty || divId.isEmpty) return;
    setState(() { _loadingExtUsers = true; _extUsers = null; _forwardUserId = null; });
    try {
      final res = await ApiClient().get<dynamic>('/departments/$deptId/divisions/$divId/users');
      final data = res.data;
      final raw = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      final list = raw is List ? raw : [];
      if (mounted) setState(() {
        _extUsers = list.map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
        _loadingExtUsers = false;
      });
    } catch (_) {
      if (mounted) setState(() { _extUsers = []; _loadingExtUsers = false; });
    }
  }

  Future<void> _forward() async {
    if (_file == null) return;
    final auth = context.read<AuthProvider>();
    final user = auth.user;
    final isDispatcher = user?.hasRole('DISPATCHER') == true;
    final canExternal = _canForwardExternally(user);

    setState(() => _forwarding = true);
    try {
      final note = _forwardRemarksController.text.trim();
      final Map<String, dynamic> payload = {};
      if (note.isNotEmpty) payload['remarks'] = note;

      if (canExternal && _forwardType == 'external') {
        if (_forwardMode == 'multiple' && !isDispatcher) {
          if (_multiRecipients.isEmpty) throw Exception('Add at least one department');
          payload['recipients'] = _multiRecipients.map((r) => {
            'toDepartmentId': r['departmentId'],
            if ((r['note']?.toString().trim() ?? '').isNotEmpty) 'remarks': r['note']?.toString().trim(),
          }).toList();
        } else {
          if ((_forwardDepartmentId ?? '').isEmpty) throw Exception('Select a department');
          payload['toDepartmentId'] = _forwardDepartmentId;
          if (isDispatcher) {
            payload['toUserId'] = null;
          } else {
            if ((_forwardDivisionId ?? '').isNotEmpty) payload['toDivisionId'] = _forwardDivisionId;
            payload['toUserId'] = (_forwardUserId ?? '').isNotEmpty ? _forwardUserId : null;
          }
        }
      } else {
        // Internal forwarding: division required; user optional
        if ((_forwardDivisionId ?? '').isEmpty) throw Exception('Select a division');
        payload['toDivisionId'] = _forwardDivisionId;
        payload['toUserId'] = (_forwardUserId ?? '').isNotEmpty ? _forwardUserId : null;
      }

      await ApiClient().post('/files/${widget.fileId}/forward', data: payload);

      if (mounted) {
        setState(() {
          _showForward = false;
          _forwarding = false;
          _forwardDivisionId = null;
          _forwardUserId = null;
          _forwardDepartmentId = null;
          _forwardType = 'internal';
          _forwardMode = 'single';
          _multiRecipients = [];
          _extDivisions = null;
          _extUsers = null;
          _forwardRemarksController.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('File forwarded successfully!')));
        await _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
        setState(() => _forwarding = false);
      }
    }
  }

  Future<void> _recall() async {
    if (_file == null) return;
    setState(() => _recalling = true);
    try {
      await ApiClient().post('/files/${widget.fileId}/recall', data: {'remarks': _recallRemarksController.text.trim()});
      if (mounted) {
        setState(() {
          _showRecall = false;
          _recalling = false;
          _recallRemarksController.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('File recalled successfully!')));
        await _load();
      }
    } catch (_) {
      if (mounted) setState(() => _recalling = false);
    }
  }

  Future<void> _loadDivisions() async {
    final deptId = _file?.departmentId ?? _file?.department?['id']?.toString();
    if (deptId == null) return;
    setState(() => _loadingDivisions = true);
    try {
      final res = await ApiClient().get<dynamic>('/departments/$deptId/divisions');
      final data = res.data;
      final list = data is List ? data : (data is Map && data['data'] is List ? data['data'] as List : []);
      if (mounted) {
        setState(() {
          _divisions = list.map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
          _loadingDivisions = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingDivisions = false);
    }
  }

  Future<void> _loadDivisionUsers() async {
    final deptId = _file?.departmentId ?? _file?.department?['id']?.toString();
    if (deptId == null || _forwardDivisionId == null) return;
    setState(() => _loadingUsers = true);
    try {
      final res = await ApiClient().get<dynamic>('/departments/$deptId/divisions/$_forwardDivisionId/users');
      final data = res.data;
      final list = data is List ? data : (data is Map && data['data'] is List ? data['data'] as List : []);
      if (mounted) {
        setState(() {
          _divisionUsers = list.map((e) => e is Map ? Map<String, dynamic>.from(e as Map) : <String, dynamic>{}).toList();
          _loadingUsers = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingUsers = false);
    }
  }

  static String _formatFileSize(int bytes) {
    if (bytes == 0) return '0 B';
    const k = 1024;
    final i = (bytes / k).clamp(0.0, 3.0).floor();
    const units = ['B', 'KB', 'MB', 'GB'];
    return '${(bytes / k).round()} ${units[i]}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = context.watch<AuthProvider>();
    final currentUserId = auth.user?.id ?? '';

    if (_loading && _file == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null && _file == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('File')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
                const SizedBox(height: 16),
                Text('Failed to load file', style: theme.textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
                const SizedBox(height: 8),
                TextButton(onPressed: () => context.go('/files/inbox'), child: const Text('Back to Inbox')),
              ],
            ),
          ),
        ),
      );
    }
    final f = _file!;
    final canEdit = _canEdit(f);
    final canRecall = _canRecall(f);
    final displayAttachments = _displayAttachments(f);
    final statusLabel = _statusLabel(f.status);

    final mainContent = RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(Responsive.padding(context).left, 16, Responsive.padding(context).right, MediaQuery.of(context).padding.bottom + 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(f.fileNumber, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(f.subject, style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (f.isRedListed) Chip(avatar: const Icon(Icons.warning_amber, size: 18, color: AppColors.red), label: const Text('Red Listed'), backgroundColor: AppColors.red.withOpacity( 0.15)),
                if (f.isOnHold) Chip(avatar: const Icon(Icons.pause_circle, size: 18), label: const Text('On Hold')),
                Chip(label: Text(statusLabel)),
                Chip(label: Text(f.priority)),
                if (f.priorityCategory != null) PriorityCategoryBadge(category: f.priorityCategory!),
              ],
            ),
            const SizedBox(height: 16),
            if (f.deskArrivalTime != null || f.allottedTime != null || f.timerPercentage != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FileTimerWidget(
                        timerPercentage: f.timerPercentage,
                        deskArrivalTime: f.deskArrivalTime,
                        allottedTime: f.allottedTime,
                        dueDate: f.dueDate,
                        isRedListed: f.isRedListed,
                        isOnHold: f.isOnHold,
                        priorityCategory: f.priorityCategory,
                        variant: FileTimerVariant.battery,
                        showLabel: true,
                      ),
                      if (f.deskArrivalTime != null) ...[
                        const SizedBox(height: 8),
                        Text('Arrived ${DateFormat.Md().add_Hm().format(f.deskArrivalTime!)}', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                      ],
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                if (canEdit)
                  FilledButton.icon(
                    icon: const Icon(Icons.send, size: 18),
                    label: const Text('Forward'),
                    onPressed: () {
                      setState(() {
                        _showForward = true;
                        _forwardDivisionId = null;
                        _forwardUserId = null;
                        _loadDivisions();
                      });
                    },
                  ),
                const SizedBox(width: 8),
                if (f.fileUrl != null || displayAttachments.isNotEmpty)
                  OutlinedButton.icon(
                    icon: const Icon(Icons.download, size: 18),
                    label: const Text('Download'),
                    onPressed: () {
                      final url = displayAttachments.isNotEmpty
                          ? _attachmentFullUrl(displayAttachments[_attachmentIndex]['url']?.toString() ?? '')
                          : ApiConfig.attachmentUrl(f.fileUrl!);
                      launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                    },
                  ),
                const SizedBox(width: 8),
                if (canRecall)
                  OutlinedButton.icon(
                    icon: const Icon(Icons.shield, size: 18),
                    label: const Text('Recall'),
                    onPressed: () => setState(() => _showRecall = true),
                    style: OutlinedButton.styleFrom(foregroundColor: AppColors.red),
                  ),
              ],
            ),
            if (!canEdit)
              Card(
                color: theme.colorScheme.primaryContainer.withOpacity( 0.3),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: theme.colorScheme.primary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'View only. This file is assigned to ${f.assignedTo?['name'] ?? 'another user'}.',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (f.isOnHold && f.holdReason != null && f.holdReason!.isNotEmpty)
              Card(
                color: AppColors.amber.withOpacity( 0.15),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      const Icon(Icons.pause_circle, color: AppColors.amber),
                      const SizedBox(width: 12),
                      Expanded(child: Text('On hold: ${f.holdReason}', style: theme.textTheme.bodySmall)),
                    ],
                  ),
                ),
              ),
            if (canEdit) ...[
              const SizedBox(height: 16),
              Text('Actions', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _ActionChip(label: 'Approve', icon: Icons.check_circle, onTap: () => setState(() => _actionType = 'approve')),
                  _ActionChip(label: 'Return', icon: Icons.reply, onTap: () => setState(() => _actionType = 'return')),
                  _ActionChip(label: 'Reject', icon: Icons.cancel, color: AppColors.red, onTap: () => setState(() => _actionType = 'reject')),
                  _ActionChip(label: 'Hold', icon: Icons.pause_circle, onTap: () => setState(() => _actionType = 'hold')),
                  _ActionChip(label: 'Extra time', icon: Icons.schedule, onTap: () => setState(() => _actionType = 'extra_time')),
                  if (canRecall) _ActionChip(label: 'Recall', icon: Icons.shield, color: AppColors.red, onTap: () => setState(() => _actionType = 'recall')),
                ],
              ),
            ],
            const SizedBox(height: 24),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('File information', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 12),
                    if (f.description != null && f.description!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(f.description!, style: theme.textTheme.bodyMedium),
                      ),
                    _InfoRow(label: 'Department', value: f.departmentName),
                    _InfoRow(label: 'Division', value: f.currentDivision?['name']?.toString() ?? '—'),
                    _InfoRow(label: 'Created by', value: f.createdBy?['name']?.toString() ?? '—'),
                    _InfoRow(label: 'Assigned to', value: f.assignedTo?['name']?.toString() ?? 'Unassigned'),
                    _InfoRow(label: 'Created', value: f.createdAt != null ? DateFormat.yMd().add_Hm().format(f.createdAt!) : '—'),
                    if (f.dueDate != null) _InfoRow(label: 'Due date', value: DateFormat.yMd().format(f.dueDate!)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Column(
                children: [
                  TabBar(
                    controller: _notesTabController,
                    onTap: (i) => setState(() => _notesHistoryTab = i),
                    labelColor: theme.colorScheme.primary,
                    tabs: const [Tab(text: 'Notes'), Tab(text: 'Timeline')],
                  ),
                  SizedBox(
                    height: 320,
                    child: IndexedStack(
                      index: _notesHistoryTab,
                      children: [
                        _NotesPanel(file: f, canEdit: canEdit, currentUserId: currentUserId, onAdd: _addNote, onRefresh: _load),
                        _HistoryPanel(file: f),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Attachments', style: theme.textTheme.titleMedium),
                        if (canEdit)
                          TextButton.icon(
                            icon: _uploading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.upload_file),
                            label: Text(_uploading ? 'Uploading…' : 'Add'),
                            onPressed: _uploading ? null : _uploadAttachments,
                          ),
                      ],
                    ),
                    if (displayAttachments.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(Icons.attach_file, size: 48, color: theme.colorScheme.onSurfaceVariant),
                              const SizedBox(height: 8),
                              Text('No attachments', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                              if (canEdit)
                                TextButton(onPressed: _uploadAttachments, child: const Text('Upload files')),
                            ],
                          ),
                        ),
                      )
                    else ...[
                      if (displayAttachments.length > 1)
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.chevron_left),
                              onPressed: _attachmentIndex > 0 ? () => setState(() => _attachmentIndex--) : null,
                            ),
                            Expanded(child: Center(child: Text('${_attachmentIndex + 1} / ${displayAttachments.length}'))),
                            IconButton(
                              icon: const Icon(Icons.chevron_right),
                              onPressed: _attachmentIndex < displayAttachments.length - 1 ? () => setState(() => _attachmentIndex++) : null,
                            ),
                          ],
                        ),
                      Builder(
                        builder: (context) {
                          final att = displayAttachments[_attachmentIndex];
                          final url = _attachmentFullUrl(att['url']?.toString() ?? '');
                          final mime = att['mimeType']?.toString() ?? '';
                          final filename = att['filename']?.toString() ?? 'file';
                          final attSize = att['size'];
                          final sizeInt = attSize is num ? attSize.toInt() : 0;
                          final isImage = mime.startsWith('image/');
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (isImage && url.isNotEmpty)
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.network(url, height: 200, width: double.infinity, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, size: 64)),
                                )
                              else
                                Container(
                                  height: 200,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(8)),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.insert_drive_file, size: 48, color: theme.colorScheme.onSurfaceVariant),
                                      const SizedBox(height: 8),
                                      Text(filename, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 8),
                                      OutlinedButton.icon(
                                        icon: const Icon(Icons.open_in_new),
                                        label: const Text('Open'),
                                        onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                                      ),
                                    ],
                                  ),
                                ),
                              const SizedBox(height: 12),
                              Text(filename, style: theme.textTheme.titleSmall),
                              Text(mime.isNotEmpty ? '${_formatFileSize(sizeInt)} • $mime' : _formatFileSize(sizeInt), style: theme.textTheme.bodySmall),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  FilledButton.tonalIcon(icon: const Icon(Icons.open_in_new), label: const Text('Open'), onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)),
                                  const SizedBox(width: 8),
                                  OutlinedButton.icon(icon: const Icon(Icons.download), label: const Text('Download'), onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)),
                                ],
                              ),
                              if (att['id'] != null && att['id'].toString() != 'legacy') ...[
                                const SizedBox(height: 12),
                                OutlinedButton.icon(
                                  icon: const Icon(Icons.history),
                                  label: const Text('Version history'),
                                  onPressed: () {
                                    showModalBottomSheet(
                                      context: context,
                                      isScrollControlled: true,
                                      builder: (ctx) => _VersionHistorySheet(
                                        attachmentId: att['id'].toString(),
                                        onFileRefresh: _load,
                                      ),
                                    );
                                  },
                                ),
                              ],
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      ...displayAttachments.asMap().entries.map((e) {
                        final att = e.value;
                        final selected = e.key == _attachmentIndex;
                        final sz = att['size'];
                        final szInt = sz is num ? sz.toInt() : 0;
                        return ListTile(
                          dense: true,
                          leading: const Icon(Icons.insert_drive_file),
                          title: Text(att['filename']?.toString() ?? 'file'),
                          subtitle: Text(_formatFileSize(szInt)),
                          selected: selected,
                          onTap: () => setState(() => _attachmentIndex = e.key),
                        );
                      }),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('File QR Code', style: theme.textTheme.titleMedium),
                        Row(
                          children: [
                            if (_qrCode != null)
                              TextButton.icon(
                                icon: const Icon(Icons.refresh),
                                label: const Text('Refresh'),
                                onPressed: _generateQrCode,
                              ),
                            FilledButton.tonalIcon(
                              icon: _loadingQr ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.qr_code_2),
                              label: Text(_qrCode != null ? 'Regenerate' : 'Generate QR'),
                              onPressed: _loadingQr ? null : _generateQrCode,
                            ),
                          ],
                        ),
                      ],
                    ),
                    if (_qrCode != null) ...[
                      const SizedBox(height: 12),
                      Builder(
                        builder: (context) {
                          final qr = _qrCode!['qrCode'] is Map ? _qrCode!['qrCode'] as Map<String, dynamic> : null;
                          final qrId = qr?['id']?.toString();
                          final imageUrl = _qrCode!['imageUrl']?.toString() ?? (qrId != null ? '${ApiConfig.baseUrl}/documents/qr/$qrId/image' : null);
                          if (imageUrl == null) return const SizedBox.shrink();
                          return InkWell(
                            onTap: () => launchUrl(Uri.parse(ApiConfig.attachmentUrl(imageUrl)), mode: LaunchMode.externalApplication),
                            child: Image.network(ApiConfig.attachmentUrl(imageUrl), height: 160, width: 160, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.qr_code_2, size: 120)),
                          );
                        },
                      ),
                      const SizedBox(height: 8),
                      TextButton.icon(
                        icon: const Icon(Icons.history),
                        label: const Text('Scan history'),
                        onPressed: () async {
                          await _loadScanHistory();
                          if (!mounted) return;
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            builder: (ctx) => _ScanHistorySheet(scanHistory: _scanHistory, loading: _loadingScanHistory),
                          );
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );

    return Stack(
      children: [
        mainContent,
        if (_actionType != null) _buildActionDialog(theme, f),
        if (_showForward) _buildForwardSheet(theme, f),
        if (_showRecall) _buildRecallDialog(theme, f),
      ],
    );
  }

  Widget _buildActionDialog(ThemeData theme, FileModel f) {
    final needsRemarks = _actionType == 'reject' || _actionType == 'return' || _actionType == 'hold' || _actionType == 'recall';
    final needsDays = _actionType == 'extra_time';
    return Stack(
      children: [
        ModalBarrier(onDismiss: () => setState(() => _actionType = null)),
        Center(
          child: Card(
            margin: const EdgeInsets.all(24),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${_actionType?.toUpperCase()} file', style: theme.textTheme.titleLarge),
                  const SizedBox(height: 16),
                  if (needsDays) ...[
                    Text('Additional days', style: theme.textTheme.labelMedium),
                    Row(
                      children: [
                        IconButton(icon: const Icon(Icons.remove), onPressed: () => setState(() => _extraDays = (_extraDays - 1).clamp(1, 365))),
                        Text('$_extraDays'),
                        IconButton(icon: const Icon(Icons.add), onPressed: () => setState(() => _extraDays = (_extraDays + 1).clamp(1, 365))),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (needsRemarks || needsDays)
                    TextField(
                      controller: _remarksController,
                      decoration: InputDecoration(
                        labelText: needsDays ? 'Reason (optional)' : 'Remarks',
                        border: const OutlineInputBorder(),
                      ),
                      maxLines: 3,
                    ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(onPressed: () => setState(() => _actionType = null), child: const Text('Cancel')),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _actionLoading ? null : _performAction,
                        child: _actionLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Confirm'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildForwardSheet(ThemeData theme, FileModel f) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final canExternal = _canForwardExternally(user);
    final isDispatcher = user?.hasRole('DISPATCHER') == true;

    return Stack(
      children: [
        ModalBarrier(onDismiss: () => setState(() => _showForward = false)),
        DraggableScrollableSheet(
          initialChildSize: 0.6,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          builder: (context, scrollController) => Card(
            margin: const EdgeInsets.all(16),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: ListView(
                controller: scrollController,
                children: [
                  Text('Forward file', style: theme.textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text('File: ${f.fileNumber}', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 24),
                  if (canExternal) ...[
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'internal', label: Text('Inside dept'), icon: Icon(Icons.home_outlined)),
                        ButtonSegment(value: 'external', label: Text('Outside dept'), icon: Icon(Icons.swap_horiz)),
                      ],
                      selected: {_forwardType},
                      onSelectionChanged: (s) async {
                        final next = s.first;
                        setState(() {
                          _forwardType = next;
                          _forwardMode = 'single';
                          _forwardDepartmentId = null;
                          _multiRecipients = [];
                          _extDivisions = null;
                          _extUsers = null;
                          _forwardDivisionId = null;
                          _forwardUserId = null;
                        });
                        if (next == 'external' && _departments.isEmpty && !_loadingDepartments) {
                          await _loadDepartments();
                        }
                        if (next == 'internal') {
                          await _loadDivisions();
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                  ],

                  if (canExternal && _forwardType == 'external') ...[
                    if (!isDispatcher)
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'single', label: Text('One dept'), icon: Icon(Icons.business_outlined)),
                          ButtonSegment(value: 'multiple', label: Text('Multiple'), icon: Icon(Icons.playlist_add)),
                        ],
                        selected: {_forwardMode},
                        onSelectionChanged: (s) async {
                          setState(() {
                            _forwardMode = s.first;
                            _forwardDepartmentId = null;
                            _multiRecipients = [];
                            _extDivisions = null;
                            _extUsers = null;
                            _forwardDivisionId = null;
                            _forwardUserId = null;
                          });
                          if (_departments.isEmpty && !_loadingDepartments) await _loadDepartments();
                        },
                      ),
                    if (!isDispatcher) const SizedBox(height: 16),

                    if (_loadingDepartments)
                      const Center(child: Padding(padding: EdgeInsets.all(8), child: SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))))
                    else if (_departments.isEmpty)
                      Text('No departments available.', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),

                    if (_forwardMode == 'multiple' && !isDispatcher) ...[
                      Text('Departments and notes', style: theme.textTheme.labelMedium),
                      const SizedBox(height: 6),
                      ..._multiRecipients.map((r) {
                        final deptName = r['departmentName']?.toString() ?? 'Department';
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  children: [
                                    Expanded(child: Text(deptName, style: theme.textTheme.titleSmall)),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline),
                                      onPressed: _forwarding ? null : () => setState(() => _multiRecipients.remove(r)),
                                    ),
                                  ],
                                ),
                                TextField(
                                  decoration: InputDecoration(labelText: 'Note for $deptName', border: const OutlineInputBorder()),
                                  controller: TextEditingController(text: r['note']?.toString() ?? ''),
                                  onChanged: (v) => r['note'] = v,
                                  maxLines: 2,
                                  enabled: !_forwarding,
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: null,
                        decoration: const InputDecoration(labelText: 'Add department', border: OutlineInputBorder()),
                        items: _departments
                            .where((d) => !_multiRecipients.any((r) => r['departmentId'] == d['id']))
                            .map((d) => DropdownMenuItem(value: d['id']?.toString(), child: Text(d['name']?.toString() ?? '')))
                            .toList(),
                        onChanged: _forwarding
                            ? null
                            : (v) {
                                if (v == null) return;
                                final dept = _departments.firstWhere((d) => d['id']?.toString() == v, orElse: () => {});
                                if (dept.isEmpty) return;
                                setState(() {
                                  _multiRecipients.add({
                                    'departmentId': v,
                                    'departmentName': dept['name']?.toString() ?? v,
                                    'note': '',
                                  });
                                });
                              },
                      ),
                      const SizedBox(height: 16),
                    ] else ...[
                      Text('Department', style: theme.textTheme.labelMedium),
                      const SizedBox(height: 4),
                      DropdownButtonFormField<String>(
                        value: _forwardDepartmentId,
                        decoration: const InputDecoration(border: OutlineInputBorder()),
                        items: _departments.map((d) {
                          final id = d['id']?.toString() ?? '';
                          final name = d['name']?.toString() ?? id;
                          return DropdownMenuItem(value: id, child: Text(name));
                        }).toList(),
                        onChanged: _forwarding
                            ? null
                            : (v) async {
                                setState(() {
                                  _forwardDepartmentId = v;
                                  _extDivisions = null;
                                  _extUsers = null;
                                  _forwardDivisionId = null;
                                  _forwardUserId = null;
                                });
                                if (!isDispatcher && v != null && v.isNotEmpty) {
                                  await _loadExternalDivisions(v);
                                }
                              },
                      ),
                      const SizedBox(height: 16),
                      if (!isDispatcher) ...[
                        Text('Division (optional)', style: theme.textTheme.labelMedium),
                        const SizedBox(height: 4),
                        DropdownButtonFormField<String>(
                          value: _forwardDivisionId,
                          decoration: const InputDecoration(border: OutlineInputBorder()),
                          items: (_extDivisions ?? const []).map((d) {
                            final id = d['id']?.toString() ?? '';
                            final name = d['name']?.toString() ?? id;
                            return DropdownMenuItem(value: id, child: Text(name));
                          }).toList(),
                          onChanged: (_forwarding || _loadingExtDivisions || (_forwardDepartmentId ?? '').isEmpty)
                              ? null
                              : (v) async {
                                  setState(() {
                                    _forwardDivisionId = v;
                                    _forwardUserId = null;
                                    _extUsers = null;
                                  });
                                  final deptId = _forwardDepartmentId ?? '';
                                  final divId = v ?? '';
                                  if (deptId.isNotEmpty && divId.isNotEmpty) {
                                    await _loadExternalUsers(deptId, divId);
                                  }
                                },
                        ),
                        const SizedBox(height: 16),
                        Text('Recipient (optional)', style: theme.textTheme.labelMedium),
                        const SizedBox(height: 4),
                        DropdownButtonFormField<String>(
                          value: _forwardUserId,
                          decoration: const InputDecoration(border: OutlineInputBorder()),
                          items: (_extUsers ?? const []).map((u) {
                            final id = u['id']?.toString() ?? '';
                            final name = u['name']?.toString() ?? u['username']?.toString() ?? id;
                            return DropdownMenuItem(value: id, child: Text(name));
                          }).toList(),
                          onChanged: (_forwarding || _loadingExtUsers) ? null : (v) => setState(() => _forwardUserId = v),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ],
                  ] else ...[
                    Text('Division', style: theme.textTheme.labelMedium),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      value: _forwardDivisionId,
                      decoration: const InputDecoration(border: OutlineInputBorder()),
                      items: _divisions?.map((d) {
                        final id = d['id']?.toString() ?? '';
                        final name = d['name']?.toString() ?? id;
                        return DropdownMenuItem(value: id, child: Text(name));
                      }).toList() ?? [],
                      onChanged: _loadingDivisions ? null : (v) {
                        setState(() {
                          _forwardDivisionId = v;
                          _forwardUserId = null;
                          _loadDivisionUsers();
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    Text('Recipient (optional)', style: theme.textTheme.labelMedium),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      value: _forwardUserId,
                      decoration: const InputDecoration(border: OutlineInputBorder()),
                      items: _divisionUsers?.map((u) {
                        final id = u['id']?.toString() ?? '';
                        final name = u['name']?.toString() ?? u['username']?.toString() ?? id;
                        return DropdownMenuItem(value: id, child: Text(name));
                      }).toList() ?? [],
                      onChanged: _loadingUsers ? null : (v) => setState(() => _forwardUserId = v),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextField(
                    controller: _forwardRemarksController,
                    decoration: InputDecoration(
                      labelText: (canExternal && _forwardType == 'external' && _forwardMode == 'multiple' && !isDispatcher) ? 'General note (optional)' : 'Note (optional)',
                      border: const OutlineInputBorder(),
                    ),
                    maxLines: 2,
                    enabled: !_forwarding,
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(child: OutlinedButton(onPressed: () => setState(() => _showForward = false), child: const Text('Cancel'))),
                      const SizedBox(width: 16),
                      Expanded(
                        child: FilledButton(
                          onPressed: _forwarding
                              ? null
                              : () {
                                  if (canExternal && _forwardType == 'external') {
                                    if (_forwardMode == 'multiple' && !isDispatcher) {
                                      if (_multiRecipients.isEmpty) return;
                                    } else {
                                      if ((_forwardDepartmentId ?? '').isEmpty) return;
                                    }
                                  } else {
                                    if ((_forwardDivisionId ?? '').isEmpty) return;
                                  }
                                  _forward();
                                },
                          child: _forwarding ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Forward'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRecallDialog(ThemeData theme, FileModel f) {
    return Stack(
      children: [
        ModalBarrier(onDismiss: () => setState(() => _showRecall = false)),
        Center(
          child: Card(
            margin: const EdgeInsets.all(24),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.warning_amber, color: theme.colorScheme.error),
                      const SizedBox(width: 8),
                      Text('Recall file', style: theme.textTheme.titleLarge),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('File ${f.fileNumber} will be recalled. This action is logged.', style: theme.textTheme.bodyMedium),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _recallRemarksController,
                    decoration: const InputDecoration(labelText: 'Remarks (optional)', border: OutlineInputBorder()),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(onPressed: () => setState(() => _showRecall = false), child: const Text('Cancel')),
                      const SizedBox(width: 8),
                      FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: theme.colorScheme.error),
                        onPressed: _recalling ? null : _recall,
                        child: _recalling ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Recall'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'PENDING': return 'Pending';
      case 'IN_PROGRESS': return 'In Progress';
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'RETURNED': return 'Returned';
      case 'ON_HOLD': return 'On Hold';
      case 'RECALLED': return 'Recalled';
      default: return s;
    }
  }
}

class _ActionChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color? color;
  final VoidCallback onTap;

  const _ActionChip({required this.label, required this.icon, this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ActionChip(
      avatar: Icon(icon, size: 18, color: color ?? theme.colorScheme.primary),
      label: Text(label),
      onPressed: onTap,
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant))),
          Expanded(child: Text(value, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

class _NotesPanel extends StatefulWidget {
  final FileModel file;
  final bool canEdit;
  final String currentUserId;
  final Future<void> Function(String) onAdd;
  final Future<void> Function() onRefresh;

  const _NotesPanel({required this.file, required this.canEdit, required this.currentUserId, required this.onAdd, required this.onRefresh});

  @override
  State<_NotesPanel> createState() => _NotesPanelState();
}

class _NotesPanelState extends State<_NotesPanel> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final notes = widget.file.notes;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: notes.isEmpty
              ? Center(child: Text('No notes yet.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)))
              : ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: notes.length,
                  itemBuilder: (context, i) {
                    final n = notes[i];
                    final user = n['user'] is Map ? n['user'] as Map<String, dynamic> : null;
                    final name = user?['name']?.toString() ?? '—';
                    final content = n['content']?.toString() ?? '';
                    final createdAt = n['createdAt']?.toString();
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
                                Text(name, style: theme.textTheme.labelLarge),
                                if (createdAt != null) ...[
                                  const Spacer(),
                                  Text(createdAt.length > 20 ? createdAt.substring(0, 19) : createdAt, style: theme.textTheme.labelSmall),
                                ],
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(content, style: theme.textTheme.bodyMedium),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        if (widget.canEdit) ...[
          const Divider(),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(hintText: 'Add a note…', border: OutlineInputBorder(), isDense: true),
                    maxLines: 2,
                    onSubmitted: (v) {
                      if (v.trim().isNotEmpty) {
                        widget.onAdd(v);
                        _controller.clear();
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () {
                    final t = _controller.text.trim();
                    if (t.isNotEmpty) {
                      widget.onAdd(t);
                      _controller.clear();
                    }
                  },
                  child: const Text('Add'),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _VersionHistorySheet extends StatefulWidget {
  final String attachmentId;
  final Future<void> Function()? onFileRefresh;

  const _VersionHistorySheet({required this.attachmentId, this.onFileRefresh});

  @override
  State<_VersionHistorySheet> createState() => _VersionHistorySheetState();
}

class _VersionHistorySheetState extends State<_VersionHistorySheet> {
  List<Map<String, dynamic>> _versions = [];
  bool _loading = true;
  bool _uploading = false;
  final _changeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _changeController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient().get<dynamic>('/documents/attachments/${widget.attachmentId}/versions');
      final data = res.data;
      final list = data is List ? data : (data is Map && data['data'] != null ? data['data'] as List : []);
      if (mounted) setState(() {
        _versions = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        _versions = [];
        _loading = false;
      });
    }
  }

  Future<void> _uploadNewVersion() async {
    final result = await FilePicker.platform.pickFiles(allowMultiple: false, type: FileType.any);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    setState(() => _uploading = true);
    try {
      final formData = FormData();
      if (file.bytes != null) {
        formData.files.add(MapEntry('file', MultipartFile.fromBytes(file.bytes!, filename: file.name)));
      } else if (file.path != null && file.path!.isNotEmpty) {
        formData.files.add(MapEntry('file', await MultipartFile.fromFile(file.path!, filename: file.name)));
      }
      if (_changeController.text.trim().isNotEmpty) {
        formData.fields.add(MapEntry('changeDescription', _changeController.text.trim()));
      }
      await ApiClient().dio.post('/documents/attachments/${widget.attachmentId}/versions', data: formData);
      _changeController.clear();
      await _load();
      await widget.onFileRefresh?.call();
    } catch (_) {}
    if (mounted) setState(() => _uploading = false);
  }

  Future<void> _restore(String versionId) async {
    try {
      await ApiClient().post('/documents/versions/$versionId/restore');
      await _load();
      await widget.onFileRefresh?.call();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Version history', style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            TextField(
              controller: _changeController,
              decoration: const InputDecoration(labelText: 'Change description (optional)', border: OutlineInputBorder(), isDense: true),
              maxLines: 1,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                FilledButton.tonalIcon(
                  icon: _uploading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.upload),
                  label: const Text('Upload new version'),
                  onPressed: _uploading ? null : _uploadNewVersion,
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(icon: const Icon(Icons.refresh), label: const Text('Refresh'), onPressed: _load),
              ],
            ),
            const SizedBox(height: 16),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _versions.isEmpty
                      ? Center(child: Text('No versions yet.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)))
                      : ListView.builder(
                          controller: scrollController,
                          itemCount: _versions.length,
                          itemBuilder: (context, i) {
                            final v = _versions[i];
                            final id = v['id']?.toString() ?? '';
                            final num = v['versionNumber'] ?? (i + 1);
                            final desc = v['changeDescription']?.toString() ?? '';
                            final createdAt = v['createdAt']?.toString() ?? '';
                            final isLatest = v['isLatest'] == true;
                            return ListTile(
                              leading: const Icon(Icons.insert_drive_file),
                              title: Text('Version $num'),
                              subtitle: Text([if (desc.isNotEmpty) desc, if (createdAt.isNotEmpty) createdAt].join(' • ')),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.download),
                                    onPressed: () => launchUrl(Uri.parse('${ApiConfig.baseUrl}/documents/versions/$id/download'), mode: LaunchMode.externalApplication),
                                  ),
                                  if (!isLatest)
                                    IconButton(
                                      icon: const Icon(Icons.restore),
                                      onPressed: () => _restore(id),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScanHistorySheet extends StatelessWidget {
  final List<Map<String, dynamic>> scanHistory;
  final bool loading;

  const _ScanHistorySheet({required this.scanHistory, required this.loading});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.8,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('QR scan history', style: theme.textTheme.titleLarge),
            const SizedBox(height: 16),
            Expanded(
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : scanHistory.isEmpty
                      ? Center(child: Text('No scans yet.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)))
                      : ListView.builder(
                          controller: scrollController,
                          itemCount: scanHistory.length,
                          itemBuilder: (context, i) {
                            final s = scanHistory[i];
                            final scannedAt = s['scannedAt'] ?? s['createdAt'] ?? '';
                            final user = s['scannedBy'] is Map ? s['scannedBy'] as Map<String, dynamic> : null;
                            final name = user?['name']?.toString() ?? '—';
                            final location = s['location']?.toString();
                            return ListTile(
                              leading: const Icon(Icons.qr_code_scanner),
                              title: Text(name),
                              subtitle: Text([if (location != null && location.isNotEmpty) location, scannedAt.toString()].join(' • ')),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryPanel extends StatelessWidget {
  final FileModel file;

  const _HistoryPanel({required this.file});

  static final _actionLabels = {
    'CREATED': 'Created',
    'FORWARDED': 'Forwarded',
    'APPROVED': 'Approved',
    'REJECTED': 'Rejected',
    'RETURNED_TO_HOST': 'Returned to host',
    'RETURNED_TO_PREVIOUS': 'Returned',
    'ON_HOLD': 'On hold',
    'RELEASED_FROM_HOLD': 'Released',
    'RECALLED': 'Recalled',
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final created = file.createdBy != null && file.createdAt != null;
    final entries = <Map<String, dynamic>>[];
    if (created) {
      entries.add({
        'id': 'created',
        'action': 'CREATED',
        'remarks': 'Created by ${file.createdBy!['name']}',
        'createdAt': file.createdAt!.toIso8601String(),
      });
    }
    for (final r in file.routingHistory) {
      entries.add(Map<String, dynamic>.from(r));
    }
    entries.sort((a, b) => (a['createdAt']?.toString() ?? '').compareTo(b['createdAt']?.toString() ?? ''));
    if (entries.isEmpty) {
      return Center(child: Text('No history yet.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: entries.length,
      itemBuilder: (context, i) {
        final e = entries[i];
        final action = e['action']?.toString() ?? e['actionString']?.toString() ?? '—';
        final label = _actionLabels[action] ?? action;
        final remarks = e['remarks']?.toString();
        final createdAt = e['createdAt']?.toString();
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6),
                decoration: BoxDecoration(color: theme.colorScheme.primary, shape: BoxShape.circle),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: theme.textTheme.titleSmall),
                    if (remarks != null && remarks.isNotEmpty) Text(remarks, style: theme.textTheme.bodySmall),
                    if (createdAt != null) Text(createdAt.length > 20 ? createdAt.substring(0, 19) : createdAt, style: theme.textTheme.labelSmall),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
