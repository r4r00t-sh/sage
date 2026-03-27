/// User model matching backend/Prisma and frontend store.
class UserModel {
  final String id;
  final String username;
  final String? email;
  final String name;
  final String? role;
  final List<String>? roles;
  final String? departmentId;
  final String? divisionId;
  final String? avatarKey;

  const UserModel({
    required this.id,
    required this.username,
    this.email,
    required this.name,
    this.role,
    this.roles,
    this.departmentId,
    this.divisionId,
    this.avatarKey,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String?,
      name: json['name'] as String,
      role: json['role'] as String?,
      roles: (json['roles'] as List<dynamic>?)?.cast<String>(),
      departmentId: json['departmentId'] as String?,
      divisionId: json['divisionId'] as String?,
      avatarKey: json['avatarKey'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'email': email,
        'name': name,
        'role': role,
        'roles': roles,
        'departmentId': departmentId,
        'divisionId': divisionId,
        'avatarKey': avatarKey,
      };

  /// Primary role for navigation (same as frontend app-sidebar).
  String get primaryRole => (roles?.isNotEmpty == true) ? roles!.first : (role ?? 'SECTION_OFFICER');

  bool hasRole(String r) => roles?.contains(r) == true || role == r;
  bool hasAnyRole(List<String> list) => list.any(hasRole);

  /// Super Admin or Tech Panel (Developer) — full app / org-structure management.
  bool get hasGodRole => hasAnyRole(['DEVELOPER', 'SUPER_ADMIN']);
}
