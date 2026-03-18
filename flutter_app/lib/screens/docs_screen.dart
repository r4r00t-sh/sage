import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:efiling_app/core/api/api_config.dart';
import 'package:efiling_app/core/utils/responsive.dart';

/// Documentation screen (Flutter-native). Mirrors web /docs page content.
class DocsScreen extends StatelessWidget {
  const DocsScreen({super.key});

  Future<void> _open(String path) async {
    final url = Uri.parse('${ApiConfig.baseUrl}$path');
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = Responsive.padding(context);

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(padding.left, 16, padding.right, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Documentation', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text('User guides and reference for the e-Filing system.', style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Quick start', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const Text('• Create a file: Dashboard or Files → New File\n'
                      '• Inbox: Files → Inbox. Claim from queue (if shown), process assigned files\n'
                      '• Track: Files → Track File. Search file number to view journey\n'
                      '• Forward/Approve: Open a file → actions based on role\n'
                      '• Dispatch: Dispatcher → Ready for Dispatch → Dispatch + upload proof'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('PDF downloads (if available)', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => _open('/docs/user-guide.pdf'),
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: const Text('Download User Guide (PDF)'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => _open('/docs/api-reference.pdf'),
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: const Text('Download API Reference (PDF)'),
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

