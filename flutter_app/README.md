# EFMP – E-Filing Management Platform (Flutter)

Cross-platform Flutter app that mirrors the EFiling-System web app: same features and UI (Roboto font, Dart 3.5 compatible).

## Features (aligned with web)

- **Auth**: Login, profile, logout; test accounts (admin, finadmin, etc.)
- **Dashboard**: Welcome, stats (Total / Pending / In Progress / Red Listed), recent files, quick actions
- **Files**: List, Inbox (search + status filter), file detail, new file, track file by number/ID
- **Opinions**: Opinion inbox (pending requests)
- **Admin** (role-based): Users, Analytics, Desks, Workflows
- **Chat**: Conversation list
- **Settings** & **Profile**

## Theme

- **Font**: Roboto (Google Fonts), compatible with Dart 3.5+.
- **Colors**: Same as `frontend/app/globals.css` (light/dark, primary, muted, destructive, etc.).
- **Radius**: 8px (0.5rem).

## Setup

1. **Flutter SDK** (3.2+): [flutter.dev](https://flutter.dev).

2. **Dependencies**:
   ```bash
   cd flutter_app
   flutter pub get
   ```

3. **API base URL**: Default is `http://localhost:3001`. For phone (same Wi‑Fi as backend), set your PC's IP when building:
   ```bash
   flutter build apk --dart-define=API_BASE_URL=http://YOUR_PC_IP:3001
   ```
   (Backend must bind on `0.0.0.0` so it accepts connections from the network.)

4. **Logo** (optional): Copy `frontend/public/logo.png` to `flutter_app/assets/logo.png` for branding on login/shell.

## Login page nav

- **Docs**: Opens the web app documentation (same host as API, path `/docs`) in the browser.
- **Download**: Dropdown with **Download for Android** and **Download for iOS**. Tapping Android opens the APK download URL (same host as API, path `/downloads/efmp-android.apk`). Host the built APK at that path on your web server so the link works.

## Build APK (for “Download for Android”)

**Option A – GitHub Actions (recommended)**  
The repo has a workflow that builds the APK in CI:

- **Triggers:** Push to `master` when `flutter_app/**` (or this workflow) changes, push of a tag `v*`, or **Run workflow** from the Actions tab.
- **Steps:** Check changes → run tests → build APK → upload artifact → create GitHub Release (on master/tag/manual).
- **Artifact:** After a run, open the workflow run and download **apk-release** from the **Build Android APK** job.
- **Releases:** On push to master or tag (or manual run), a GitHub Release is created with the APK attached (e.g. `efiling_app-v1.0.0.apk`).
- **API URL in APK:** In the repo **Settings → Secrets and variables → Actions**, add a secret `API_BASE_URL` (e.g. `https://sage.santhigiri.cloud/api`). Or when using **Run workflow**, fill **API base URL**. The built APK will then use that URL by default.

Workflow file: `.github/workflows/release-flutter.yml`.

**Option B – Local build**

```bash
cd flutter_app
flutter pub get
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

Copy `app-release.apk` to your web server as `downloads/efmp-android.apk` (or the path your API base URL’s host serves), so “Download for Android” in the app triggers the download.

## Run

```bash
cd flutter_app
flutter run
```

- **Web**: `flutter run -d chrome`
- **Android**: `flutter run -d android`
- **iOS**: `flutter run -d ios`
- **Windows**: `flutter run -d windows`

## Project layout

- `lib/core/theme/` – App theme, Roboto, colors from web
- `lib/core/api/` – API client (Dio + Bearer token), config
- `lib/core/auth/` – AuthProvider (user + token, 401 → logout)
- `lib/core/router/` – go_router (login vs shell, role-based nav in shell)
- `lib/models/` – User, File models
- `lib/screens/` – Login, Dashboard, Shell (drawer), Files (list/inbox/detail/new/track), Opinions, Admin, Chat, Settings, Profile

Backend is the existing NestJS API; no backend code changes required.
