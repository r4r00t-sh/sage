import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/api/api_config.dart';
import 'package:efiling_app/core/api/api_client.dart';
import 'package:efiling_app/core/utils/responsive.dart';

/// Login screen: [Forui](https://forui.dev/) card + fields, responsive split layout on wide screens.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _apiUrlController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _showApiUrl = false;

  @override
  void initState() {
    super.initState();
    _apiUrlController.text = ApiConfig.baseUrl;
  }

  @override
  void dispose() {
    _apiUrlController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _saveApiUrl() async {
    final url = _apiUrlController.text.trim();
    if (url.isEmpty) return;
    await ApiConfig.setBaseUrl(url);
    ApiClient().reset();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('API URL saved. New requests will use it.')),
      );
    }
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    final result = await context.read<AuthProvider>().login(
          _usernameController.text.trim(),
          _passwordController.text,
        );
    if (!mounted) return;
    setState(() => _loading = false);
    if (result.success) {
      context.go('/dashboard');
    } else {
      setState(() => _error = result.errorMessage ?? 'Invalid username or password');
    }
  }

  Future<void> _openDocs() async {
    final uri = Uri.parse(ApiConfig.docsUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _downloadAndroid() async {
    final uri = Uri.parse(ApiConfig.downloadAndroidUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open download link. Check the URL.')),
      );
    }
  }

  Future<void> _downloadIos() async {
    final uri = Uri.parse(ApiConfig.downloadIosUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open download link. Check the URL.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isWide = MediaQuery.sizeOf(context).width >= 900;
    final pad = Responsive.padding(context);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                'assets/logo.png',
                width: 32,
                height: 32,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Icon(Icons.description, color: theme.colorScheme.primary),
              ),
            ),
            const SizedBox(width: 10),
            Text('EFMP', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
          ],
        ),
        centerTitle: false,
        actions: [
          FButton(
            variant: FButtonVariant.ghost,
            size: FButtonSizeVariant.sm,
            onPress: _openDocs,
            prefix: const Icon(FIcons.bookOpen, size: 18),
            child: const Text('Docs'),
          ),
          PopupMenuButton<String>(
            tooltip: 'Download',
            offset: const Offset(0, 48),
            itemBuilder: (context) => [
              const PopupMenuItem<String>(
                value: 'android',
                child: ListTile(
                  leading: Icon(Icons.android),
                  title: Text('Download for Android'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem<String>(
                value: 'ios',
                child: ListTile(
                  leading: Icon(Icons.phone_iphone),
                  title: Text('Download for iOS'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
            onSelected: (value) {
              if (value == 'android') _downloadAndroid();
              if (value == 'ios') _downloadIos();
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Download', style: theme.textTheme.bodyMedium),
                  const SizedBox(width: 4),
                  const Icon(Icons.arrow_drop_down, size: 24),
                ],
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Row(
          children: [
            if (isWide) _buildLeftPanel(context),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                child: SingleChildScrollView(
                  key: ValueKey(isWide),
                  padding: pad.copyWith(top: 24, bottom: 24),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: FCard(
                        title: const Text('Welcome back'),
                        subtitle: const Text('Enter your credentials to access your account'),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (!isWide) _buildMobileLogo(),
                              FButton(
                                variant: FButtonVariant.ghost,
                                size: FButtonSizeVariant.sm,
                                onPress: () => setState(() => _showApiUrl = !_showApiUrl),
                                prefix: Icon(_showApiUrl ? FIcons.chevronUp : FIcons.chevronDown, size: 18),
                                child: Text(_showApiUrl ? 'Hide API URL' : 'Configure API URL'),
                              ),
                              if (_showApiUrl) ...[
                                const SizedBox(height: 8),
                                FTextField(
                                  control: FTextFieldControl.managed(controller: _apiUrlController),
                                  label: const Text('API Base URL'),
                                  hint: 'http://192.168.1.33:3001',
                                  description: const Text('Change this when your IP address changes'),
                                  keyboardType: TextInputType.url,
                                  textInputAction: TextInputAction.done,
                                  enabled: !_loading,
                                  prefixBuilder: (c, s, v) =>
                                      FTextField.prefixIconBuilder(c, s, v, const Icon(FIcons.link)),
                                  onSubmit: (_) => _saveApiUrl(),
                                ),
                                const SizedBox(height: 8),
                                FButton(
                                  variant: FButtonVariant.outline,
                                  size: FButtonSizeVariant.sm,
                                  onPress: _loading ? null : _saveApiUrl,
                                  child: const Text('Save API URL'),
                                ),
                                const SizedBox(height: 16),
                              ],
                              FTextField(
                                control: FTextFieldControl.managed(controller: _usernameController),
                                label: const Text('Username'),
                                hint: 'Enter your username',
                                textInputAction: TextInputAction.next,
                                enabled: !_loading,
                                prefixBuilder: (c, s, v) => FTextField.prefixIconBuilder(c, s, v, const Icon(FIcons.user)),
                              ),
                              const SizedBox(height: 12),
                              FTextField.password(
                                control: FTextFieldControl.managed(controller: _passwordController),
                                label: const Text('Password'),
                                hint: 'Enter your password',
                                textInputAction: TextInputAction.done,
                                enabled: !_loading,
                                onSubmit: (_) => _submit(),
                              ),
                              if (_error != null) ...[
                                const SizedBox(height: 12),
                                FAlert(
                                  variant: FAlertVariant.destructive,
                                  title: const Text('Sign-in failed'),
                                  subtitle: Text(_error!),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _error!.toLowerCase().contains('reach') || _error!.toLowerCase().contains('server')
                                      ? 'Check your internet connection and server URL in Settings.'
                                      : 'Check your username and password and try again.',
                                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                                ),
                              ],
                              const SizedBox(height: 20),
                              FButton(
                                onPress: _loading ? null : _submit,
                                child: _loading
                                    ? const SizedBox(
                                        height: 22,
                                        width: 22,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Text('Sign In'),
                                          const SizedBox(width: 8),
                                          Icon(FIcons.arrowRight, size: 18),
                                        ],
                                      ),
                              ),
                              const SizedBox(height: 20),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMobileLogo() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.asset(
              'assets/logo.png',
              width: 56,
              height: 56,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => Container(
                width: 56,
                height: 56,
                color: Theme.of(context).colorScheme.primary,
                child: const Icon(Icons.description, color: Colors.white, size: 32),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text('EFMP', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _buildLeftPanel(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: MediaQuery.sizeOf(context).width * 0.42,
      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 36),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            theme.colorScheme.primary,
            theme.colorScheme.primary.withValues(alpha: 0.92),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Center(
                  child: Image.asset(
                    'assets/logo.png',
                    width: 48,
                    height: 48,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.description, color: Colors.white, size: 32),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Text(
                'EFMP',
                style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const Spacer(),
          Text(
            'Streamline Your\nDocument Workflow',
            style: theme.textTheme.headlineLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.bold, height: 1.2),
          ),
          const SizedBox(height: 16),
          Text(
            'Manage, track, and process files efficiently with our enterprise-grade e-filing solution.',
            style: theme.textTheme.bodyLarge?.copyWith(color: Colors.white.withValues(alpha: 0.92)),
          ),
          const Spacer(),
          Text(
            '© 2026 EFMP. All rights reserved.',
            style: theme.textTheme.bodySmall?.copyWith(color: Colors.white.withValues(alpha: 0.65)),
          ),
        ],
      ),
    );
  }
}
