import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/utils/responsive.dart';

/// Workflow builder – view/edit workflow steps (simplified; full visual editor can be added later).
/// Responsive: single column on phone, two columns on tablet.
class WorkflowBuilderScreen extends StatefulWidget {
  const WorkflowBuilderScreen({super.key, required this.workflowId});

  final String workflowId;

  @override
  State<WorkflowBuilderScreen> createState() => _WorkflowBuilderScreenState();
}

class _WorkflowBuilderScreenState extends State<WorkflowBuilderScreen> {
  Map<String, dynamic>? _workflow;
  List<dynamic> _nodes = [];
  List<dynamic> _edges = [];
  bool _loading = true;
  String? _error;
  bool _saving = false;

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
      final res = await ApiClient().get<dynamic>('/workflows/${widget.workflowId}');
      final data = res.data;
      if (mounted && data is Map) {
        final w = Map<String, dynamic>.from(data as Map);
        setState(() {
          _workflow = w;
          _nodes = w['nodes'] is List ? List<dynamic>.from(w['nodes'] as List) : [];
          _edges = w['edges'] is List ? List<dynamic>.from(w['edges'] as List) : [];
          _loading = false;
        });
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

  static IconData _nodeIcon(String? nodeType) {
    switch (nodeType) {
      case 'start': return Icons.play_circle_outline;
      case 'task': return Icons.check_box_outlined;
      case 'decision': return Icons.call_split;
      case 'end': return Icons.stop_circle_outlined;
      default: return Icons.circle_outlined;
    }
  }

  static Color _nodeColor(BuildContext context, String? nodeType) {
    final theme = Theme.of(context);
    switch (nodeType) {
      case 'start': return Colors.green;
      case 'task': return theme.colorScheme.primary;
      case 'decision': return Colors.amber;
      case 'end': return theme.colorScheme.outline;
      default: return theme.colorScheme.primary;
    }
  }

  String _nodeLabel(Map<String, dynamic> node) {
    return node['label']?.toString() ?? node['nodeId']?.toString() ?? 'Node';
  }

  Map<String, dynamic>? _findNode(String? id) {
    if (id == null) return null;
    for (final n in _nodes) {
      if (n is Map && n['id']?.toString() == id) return Map<String, dynamic>.from(n as Map);
    }
    return null;
  }

  Future<void> _publish() async {
    setState(() => _saving = true);
    try {
      await ApiClient().post('/workflows/${widget.workflowId}/publish');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Workflow published')));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Publish failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _validate() async {
    try {
      final res = await ApiClient().get<dynamic>('/workflows/${widget.workflowId}/validate');
      final data = res.data;
      if (!mounted) return;
      await showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Workflow validation'),
          content: SingleChildScrollView(child: Text(data is Map ? data.toString() : (data?.toString() ?? 'OK'))),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
        ),
      );
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Validate failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    }
  }

  Future<void> _addNode() async {
    final nodeIdCtrl = TextEditingController();
    final labelCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String nodeType = 'task';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Add node'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: nodeIdCtrl, decoration: const InputDecoration(labelText: 'Node ID', border: OutlineInputBorder())),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: nodeType,
                  decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
                  items: const [
                    DropdownMenuItem(value: 'start', child: Text('start')),
                    DropdownMenuItem(value: 'task', child: Text('task')),
                    DropdownMenuItem(value: 'decision', child: Text('decision')),
                    DropdownMenuItem(value: 'end', child: Text('end')),
                  ],
                  onChanged: (v) => setLocal(() => nodeType = v ?? 'task'),
                ),
                const SizedBox(height: 8),
                TextField(controller: labelCtrl, decoration: const InputDecoration(labelText: 'Label', border: OutlineInputBorder())),
                const SizedBox(height: 8),
                TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description (optional)', border: OutlineInputBorder()), maxLines: 2),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    final nodeId = nodeIdCtrl.text.trim();
    final label = labelCtrl.text.trim();
    if (nodeId.isEmpty || label.isEmpty) return;

    setState(() => _saving = true);
    try {
      await ApiClient().post('/workflows/${widget.workflowId}/nodes', data: {
        'nodeId': nodeId,
        'nodeType': nodeType,
        'label': label,
        if (descCtrl.text.trim().isNotEmpty) 'description': descCtrl.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Node added')));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Add node failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _editNode(Map<String, dynamic> node) async {
    final nodeDbId = node['id']?.toString() ?? '';
    if (nodeDbId.isEmpty) return;
    final labelCtrl = TextEditingController(text: node['label']?.toString() ?? '');
    final descCtrl = TextEditingController(text: node['description']?.toString() ?? '');

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit node'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: labelCtrl, decoration: const InputDecoration(labelText: 'Label', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()), maxLines: 2),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok != true) return;

    setState(() => _saving = true);
    try {
      await ApiClient().patch('/workflows/nodes/$nodeDbId', data: {
        'label': labelCtrl.text.trim(),
        'description': descCtrl.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Node updated')));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Update failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _deleteNode(Map<String, dynamic> node) async {
    final nodeDbId = node['id']?.toString() ?? '';
    if (nodeDbId.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete node'),
        content: Text('Delete "${_nodeLabel(node)}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;

    setState(() => _saving = true);
    try {
      await ApiClient().delete('/workflows/nodes/$nodeDbId');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Node deleted')));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addEdge() async {
    if (_nodes.length < 2) return;
    String? sourceId;
    String? targetId;
    final labelCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add connection'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: sourceId,
                decoration: const InputDecoration(labelText: 'Source', border: OutlineInputBorder()),
                items: _nodes.whereType<Map>().map((n) {
                  final m = Map<String, dynamic>.from(n);
                  return DropdownMenuItem(value: m['id']?.toString(), child: Text(_nodeLabel(m)));
                }).toList(),
                onChanged: (v) => sourceId = v,
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: targetId,
                decoration: const InputDecoration(labelText: 'Target', border: OutlineInputBorder()),
                items: _nodes.whereType<Map>().map((n) {
                  final m = Map<String, dynamic>.from(n);
                  return DropdownMenuItem(value: m['id']?.toString(), child: Text(_nodeLabel(m)));
                }).toList(),
                onChanged: (v) => targetId = v,
              ),
              const SizedBox(height: 8),
              TextField(controller: labelCtrl, decoration: const InputDecoration(labelText: 'Label (optional)', border: OutlineInputBorder())),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add')),
        ],
      ),
    );
    if (ok != true) return;
    if ((sourceId ?? '').isEmpty || (targetId ?? '').isEmpty) return;

    setState(() => _saving = true);
    try {
      await ApiClient().post('/workflows/${widget.workflowId}/edges', data: {
        'sourceNodeId': sourceId,
        'targetNodeId': targetId,
        if (labelCtrl.text.trim().isNotEmpty) 'label': labelCtrl.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Connection added')));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Add connection failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _deleteEdge(Map<String, dynamic> edge) async {
    final edgeId = edge['id']?.toString() ?? '';
    if (edgeId.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete connection'),
        content: const Text('Delete this connection?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _saving = true);
    try {
      await ApiClient().delete('/workflows/edges/$edgeId');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Connection deleted')));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: ${e.toString().replaceFirst('DioException: ', '')}')));
    } finally {
      if (mounted) setState(() => _saving = false);
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
              Text('Failed to load workflow', style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
              const SizedBox(height: 24),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
              const SizedBox(height: 8),
              TextButton(onPressed: () => context.go('/admin/workflows'), child: const Text('Back to Workflows')),
            ],
          ),
        ),
      );
    }

    final name = _workflow?['name']?.toString() ?? 'Workflow';
    final code = _workflow?['code']?.toString() ?? '';
    final description = _workflow?['description']?.toString();
    final isActive = _workflow?['isActive'] == true;
    final isDraft = _workflow?['isDraft'] == true;

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        padding: padding,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: Responsive.contentMaxWidth(context)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.go('/admin/workflows')),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text(name, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold))),
                            if (isActive)
                              Chip(
                                avatar: const Icon(Icons.check_circle, size: 16, color: Colors.green),
                                label: const Text('Active', style: TextStyle(fontSize: 12)),
                                padding: EdgeInsets.zero,
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              )
                            else if (isDraft)
                              Chip(
                                avatar: Icon(Icons.edit, size: 16, color: theme.colorScheme.primary),
                                label: const Text('Draft', style: TextStyle(fontSize: 12)),
                                padding: EdgeInsets.zero,
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                          ],
                        ),
                        if (code.isNotEmpty) Text(code, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                        if (description != null && description.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(description, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.tonalIcon(onPressed: _saving ? null : _addNode, icon: const Icon(Icons.add), label: const Text('Add node')),
                  FilledButton.tonalIcon(onPressed: _saving ? null : _addEdge, icon: const Icon(Icons.arrow_right_alt), label: const Text('Add connection')),
                  OutlinedButton.icon(onPressed: _saving ? null : _validate, icon: const Icon(Icons.rule), label: const Text('Validate')),
                  FilledButton.icon(onPressed: _saving ? null : _publish, icon: _saving ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.publish), label: const Text('Publish')),
                ],
              ),
              const SizedBox(height: 24),
              Text('Nodes', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              if (_nodes.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: Text('No nodes defined', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ),
                  ),
                )
              else
                ...List.generate(_nodes.length, (i) {
                  final node = _nodes[i] is Map ? _nodes[i] as Map<String, dynamic> : <String, dynamic>{};
                  final nodeType = node['nodeType']?.toString() ?? 'task';
                  final label = _nodeLabel(node);
                  final desc = node['description']?.toString();
                  final assigneeType = node['assigneeType']?.toString();
                  final assigneeValue = node['assigneeValue']?.toString();
                  final timeLimit = node['timeLimit'] is num ? (node['timeLimit'] as num).toInt() : null;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: _nodeColor(context, nodeType).withOpacity( 0.2),
                            child: Icon(_nodeIcon(nodeType), color: _nodeColor(context, nodeType), size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(child: Text(label, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600))),
                                    IconButton(icon: const Icon(Icons.edit_outlined, size: 18), onPressed: _saving ? null : () => _editNode(node)),
                                    IconButton(icon: const Icon(Icons.delete_outline, size: 18), onPressed: _saving ? null : () => _deleteNode(node)),
                                  ],
                                ),
                                Chip(
                                  label: Text(nodeType, style: const TextStyle(fontSize: 11)),
                                  padding: EdgeInsets.zero,
                                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  visualDensity: VisualDensity.compact,
                                ),
                                if (desc != null && desc.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(desc, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                                  ),
                                if (assigneeType != null && assigneeType.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    'Assignee: ${assigneeType.toLowerCase()}${assigneeValue != null && assigneeValue.isNotEmpty ? ' ($assigneeValue)' : ''}',
                                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                                  ),
                                ],
                                if (timeLimit != null && timeLimit > 0)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Text(
                                      'Time limit: ${timeLimit ~/ 3600}h',
                                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              const SizedBox(height: 24),
              Text('Connections', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              if (_edges.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: Text('No connections yet', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ),
                  ),
                )
              else
                ...List.generate(_edges.length, (i) {
                  final edge = _edges[i] is Map ? _edges[i] as Map<String, dynamic> : <String, dynamic>{};
                  final sourceId = edge['sourceNodeId']?.toString();
                  final targetId = edge['targetNodeId']?.toString();
                  final edgeLabel = edge['label']?.toString();
                  final sourceNode = _findNode(sourceId);
                  final targetNode = _findNode(targetId);
                  final sourceLabel = sourceNode != null ? _nodeLabel(sourceNode) : 'Unknown';
                  final targetLabel = targetNode != null ? _nodeLabel(targetNode) : 'Unknown';
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: const Icon(Icons.arrow_forward),
                      title: Text('$sourceLabel → $targetLabel'),
                      subtitle: edgeLabel != null && edgeLabel.isNotEmpty ? Text(edgeLabel) : null,
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: _saving ? null : () => _deleteEdge(edge),
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}
