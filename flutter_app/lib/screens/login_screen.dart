import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:efiling_app/core/auth/auth_provider.dart';
import 'package:efiling_app/core/theme/app_colors.dart';
import 'package:efiling_app/core/api/api_config.dart';
import 'package:efiling_app/core/api/api_client.dart';

/// Login screen matching web: left branding panel, right form, test accounts.
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

  // Must match backend seed (prisma/seed.ts). All use password123 except Super Admin (admin123).
  static const _testAccounts = [
    _TestAccount(role: 'Super Admin', username: 'admin', password: 'admin123', name: 'Super Administrator', dept: 'All Departments', color: AppColors.red),
    _TestAccount(role: 'Dept Admin', username: 'fin.admin', password: 'password123', name: 'Finance Department Admin', dept: 'Finance Department', color: Colors.purple),
    _TestAccount(role: 'Section Officer', username: 'fin.accounts', password: 'password123', name: 'Accounts Section Officer', dept: 'Finance > Accounts', color: AppColors.blue),
    _TestAccount(role: 'Approval Auth', username: 'fin.approver', password: 'password123', name: 'Finance Approval Authority', dept: 'Finance > Accounts', color: AppColors.amber),
    _TestAccount(role: 'Dispatcher', username: 'fin.dispatch', password: 'password123', name: 'Finance Dispatcher', dept: 'Finance > Accounts', color: Colors.cyan),
    _TestAccount(role: 'Inward Desk', username: 'fin.inward', password: 'password123', name: 'Finance Inward Desk', dept: 'Finance > Accounts', color: AppColors.green),
    _TestAccount(role: 'Clerk', username: 'fin.clerk', password: 'password123', name: 'Finance Clerk', dept: 'Finance', color: Colors.indigo),
    _TestAccount(role: 'Chat Manager', username: 'fin.chat', password: 'password123', name: 'Finance Chat Manager', dept: 'Finance', color: Colors.teal),
    _TestAccount(role: 'Dept Admin', username: 'agr.admin', password: 'password123', name: 'Agriculture Department Admin', dept: 'Agriculture Department', color: Colors.green),
    _TestAccount(role: 'Dept Admin', username: 'ops.admin', password: 'password123', name: 'Operations Department Admin', dept: 'Operations Department', color: Colors.orange),
  ];

  @override
  void initState() {
    super.initState();
    // Load current API URL
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

  void _fillTest(_TestAccount a) {
    _usernameController.text = a.username;
    _passwordController.text = a.password;
    setState(() => _error = null);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Selected: ${a.name}. Tap Sign In to continue.')),
    );
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
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open download link. Check the URL.')),
        );
      }
    }
  }

  Future<void> _downloadIos() async {
    final uri = Uri.parse(ApiConfig.downloadIosUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open download link. Check the URL.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isWide = MediaQuery.sizeOf(context).width >= 900;

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
          TextButton.icon(
            onPressed: _openDocs,
            icon: const Icon(Icons.menu_book_outlined, size: 20),
            label: const Text('Docs'),
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
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (!isWide) _buildMobileLogo(),
                      const SizedBox(height: 40),
                      Text(
                        'Welcome back',
                        style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Enter your credentials to access your account',
                        style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 24),
                      // API URL field (collapsible)
                      Row(
                        children: [
                          Expanded(
                            child: TextButton.icon(
                              onPressed: () {
                                setState(() => _showApiUrl = !_showApiUrl);
                              },
                              icon: Icon(_showApiUrl ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down),
                              label: Text(_showApiUrl ? 'Hide API URL' : 'Configure API URL'),
                              style: TextButton.styleFrom(
                                foregroundColor: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (_showApiUrl) ...[
                        const SizedBox(height: 8),
                        TextField(
                          controller: _apiUrlController,
                          decoration: InputDecoration(
                            labelText: 'API Base URL',
                            hintText: 'http://192.168.1.33:3001',
                            prefixIcon: const Icon(Icons.link),
                            suffixIcon: IconButton(
                              icon: const Icon(Icons.save),
                              tooltip: 'Save API URL',
                              onPressed: _saveApiUrl,
                            ),
                            helperText: 'Change this when your IP address changes',
                          ),
                          keyboardType: TextInputType.url,
                          textInputAction: TextInputAction.done,
                          enabled: !_loading,
                          onSubmitted: (_) => _saveApiUrl(),
                        ),
                        const SizedBox(height: 16),
                      ],
                      TextField(
                        controller: _usernameController,
                        decoration: const InputDecoration(
                          labelText: 'Username',
                          hintText: 'Enter your username',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        textInputAction: TextInputAction.next,
                        enabled: !_loading,
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _passwordController,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          hintText: 'Enter your password',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                        obscureText: true,
                        onSubmitted: (_) => _submit(),
                        enabled: !_loading,
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                        const SizedBox(height: 8),
                        Text(
                          _error!.toLowerCase().contains('reach') || _error!.toLowerCase().contains('server')
                              ? 'Check your internet connection and server URL in Settings.'
                              : 'Check your username and password and try again.',
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        ),
                      ],
                      const SizedBox(height: 24),
                      SizedBox(
                        height: 56,
                        child: FilledButton(
                          onPressed: _loading ? null : _submit,
                          child: _loading
                              ? const SizedBox(
                                  height: 24,
                                  width: 24,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text('Sign In'),
                                    SizedBox(width: 8),
                                    Icon(Icons.arrow_forward, size: 20),
                                  ],
                                ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Divider(),
                      const SizedBox(height: 16),
                      Text(
                        'Test Accounts',
                        style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 8),
                      ..._testAccounts.map((a) => _TestAccountTile(account: a, onTap: () => _fillTest(a))),
                    ],
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
      padding: const EdgeInsets.only(bottom: 24),
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
      width: MediaQuery.sizeOf(context).width * 0.45,
      padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 40),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            theme.colorScheme.primary,
            theme.colorScheme.primary.withOpacity( 0.95),
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
                  color: Colors.white.withOpacity( 0.2),
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
              Text('EFMP', style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
            ],
          ),
          const Spacer(),
          Text(
            'Streamline Your\nDocument Workflow',
            style: theme.textTheme.headlineLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.bold, height: 1.2),
          ),
          const SizedBox(height: 16),
          Text(
            'Manage, track, and process files efficiently with our enterprise-grade e-filing solution designed for government organizations.',
            style: theme.textTheme.bodyLarge?.copyWith(color: Colors.white.withOpacity( 0.9)),
          ),
          const Spacer(),
          Text(
            '© 2026 EFMP. All rights reserved.',
            style: theme.textTheme.bodySmall?.copyWith(color: Colors.white.withOpacity( 0.6)),
          ),
        ],
      ),
    );
  }
}

class _TestAccount {
  final String role, username, password, name, dept;
  final Color color;
  const _TestAccount({required this.role, required this.username, required this.password, required this.name, required this.dept, required this.color});
}

class _TestAccountTile extends StatelessWidget {
  final _TestAccount account;
  final VoidCallback onTap;

  const _TestAccountTile({required this.account, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initials = account.name.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: theme.cardTheme.color,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                CircleAvatar(backgroundColor: account.color, radius: 20, child: Text(initials, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12))),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(child: Text(account.name, style: theme.textTheme.titleSmall, overflow: TextOverflow.ellipsis)),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(4)),
                            child: Text(account.role, style: theme.textTheme.labelSmall),
                          ),
                        ],
                      ),
                      Text(account.dept, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant), maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text('${account.username} / ${account.password}', style: theme.textTheme.bodySmall?.copyWith(fontFamily: 'monospace')),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward, size: 16, color: theme.colorScheme.onSurfaceVariant),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
