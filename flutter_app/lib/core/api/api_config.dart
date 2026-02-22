import 'package:shared_preferences/shared_preferences.dart';

/// API base URL and token storage. Set when building for phone:
///   flutter build apk --dart-define=API_BASE_URL=http://YOUR_PC_IP:3001
/// (Use your PC's local IP so the phone can reach the backend on same Wi‑Fi.)
/// Optional runtime override is stored in Settings and loaded at startup.
class ApiConfig {
  static const String _defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.1.33:3001',
  );

  static String? _overrideBaseUrl;

  /// Current API base URL (saved override or build-time default).
  static String get baseUrl => _overrideBaseUrl?.trim().isNotEmpty == true
      ? _overrideBaseUrl!.endsWith('/')
          ? _overrideBaseUrl!.substring(0, _overrideBaseUrl!.length - 1)
          : _overrideBaseUrl!
      : _defaultBaseUrl;

  /// Load saved server URL from device (call before any API use, e.g. in main()).
  /// Ignores localhost/127.0.0.1 so on phone we use build default (your PC IP).
  static Future<void> loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_keyBaseUrl);
    if (saved == null || saved.isEmpty) {
      _overrideBaseUrl = null;
      return;
    }
    final lower = saved.toLowerCase();
    if (lower.contains('localhost') || lower.contains('127.0.0.1')) {
      _overrideBaseUrl = null;
      return;
    }
    _overrideBaseUrl = saved;
  }

  static const String _keyBaseUrl = 'api_base_url';

  /// Set server URL and persist. Call ApiClient().reset() after this so requests use the new URL.
  static Future<void> setBaseUrl(String url) async {
    final trimmed = url.trim();
    _overrideBaseUrl = trimmed.isEmpty ? null : (trimmed.endsWith('/') ? trimmed.substring(0, trimmed.length - 1) : trimmed);
    final prefs = await SharedPreferences.getInstance();
    if (_overrideBaseUrl == null) {
      await prefs.remove(_keyBaseUrl);
    } else {
      await prefs.setString(_keyBaseUrl, _overrideBaseUrl!);
    }
  }

  static const String _tokenKey = 'auth_token';

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  /// Set by app when 401 is received to redirect to login.
  static void Function()? onUnauthorized;

  /// Full URL for attachment/download (backend returns relative path).
  static String attachmentUrl(String path) {
    if (path.isEmpty) return baseUrl;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final base = baseUrl.endsWith('/') ? baseUrl : '$baseUrl/';
    final p = path.startsWith('/') ? path.substring(1) : path;
    return '$base$p';
  }

  static int _defaultPortForScheme(String scheme) {
    switch (scheme.toLowerCase()) {
      case 'https':
        return 443;
      case 'http':
        return 80;
      default:
        return 80;
    }
  }

  /// Web app base URL (same host as API; port 3000 for web frontend if API is 3001).
  static String get _webBaseUrl {
    final uri = Uri.tryParse(baseUrl);
    if (uri == null) return baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    final port = uri.port == 3001 ? 3000 : uri.port;
    final path = (uri.path.isEmpty || uri.path == '/' || uri.path.endsWith('/api'))
        ? ''
        : uri.path.replaceFirst(RegExp(r'/api/?$'), '');
    final defaultPort = _defaultPortForScheme(uri.scheme);
    return '${uri.scheme}://${uri.host}${port != defaultPort ? ':$port' : ''}$path';
  }

  /// Docs page URL (opens in browser).
  static String get docsUrl => '$_webBaseUrl${_webBaseUrl.endsWith('/') ? '' : '/'}docs';

  /// Android APK download URL. Host the built APK at this path on your web server.
  static String get downloadAndroidUrl => '$_webBaseUrl${_webBaseUrl.endsWith('/') ? '' : '/'}downloads/efmp-android.apk';

  /// iOS app download URL (App Store or enterprise link).
  static String get downloadIosUrl => '$_webBaseUrl${_webBaseUrl.endsWith('/') ? '' : '/'}downloads/efmp-ios';
}
