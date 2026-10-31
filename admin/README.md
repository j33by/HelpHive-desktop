# HelpHive Admin (Windows)

A desktop console for the HelpHive team. Black and white, built for Windows 10/11 and wide screens only.

## Run it

```
cd admin
npm install
npm start          # opens the console
npm run dist       # builds dist/HelpHive-Admin-Setup-1.0.0.exe and a portable .exe
```

The GitHub Action in `.github/workflows/admin.yml` builds the same installer on a Windows runner (Actions → HelpHive Admin → Run workflow → download the artifact). The installer is not code-signed, so Windows SmartScreen shows "More info → Run anyway" the first time.

## Phone and tablet (Android APK)

The same console runs on phones and tablets. Below 900 px wide it switches to a mobile layout: a slide-in menu, a bottom tab bar (Dashboard, Users, Inbox, Control, More), tables turn into cards, and dialogs and the account panel go full screen. It follows rotation and any screen size.

It is the same code wrapped with Capacitor, so every feature works. The Android app also blocks screenshots (FLAG_SECURE) and the back button closes dialogs first.

**Build it on GitHub:** Actions → "HelpHive Admin (Android APK)" (or "Build HelpHive Admin (Android APK)" when `admin/` is its own repo) → Run workflow → download `helphive-admin-android` → unzip → `HelpHive-Admin.apk`. Copy it to the phone and install it (allow "install unknown apps" for the app you open it from). It is a debug-signed APK, fine for your own team.

**Build it locally** (needs Node 22, JDK 21 and the Android SDK):

```
cd admin
npm install
npm run build:web
npm run android:add     # once
npm run android:sync
cd android && ./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
```

No server change is needed. Requests from the Android app go through the native HTTP layer, so there is no CORS setup. The server address must be https.

## Sign in

Enter your server address (the Render URL) and your admin email and password. Admin accounts are **not** app accounts; they live in the `admins` table. The first owner is created in one of two ways (see the main README, "Admin console").

The sign-in token is kept only in memory by the app. Closing it signs you out, and it signs you out by itself after the idle time set in Settings (default 30 minutes). `Ctrl+L` locks it right away.

## Keyboard

| Keys | Does |
|---|---|
| Ctrl+K | Command palette: jump anywhere, or type a username to find someone |
| Ctrl+1 … Ctrl+0 | Dashboard, Users, Content, Events, Inbox, Control, Audit log, Team, Settings, System |
| Ctrl+F | Find a user |
| F5 | Refresh the current tab |
| Ctrl+L | Lock and sign out |
| Esc | Close a dialog or drawer |

(Keyboard shortcuts are for the Windows app.)

## What is in each tab

- **Dashboard**: total, active and average daily users, log ins, peak hour, posts, comments, message counts, restricted and banned totals, with graphs. Ranges: 24 hours, 7, 30, 90 days, 1 year or custom. Export to CSV.
- **Users**: search by name, username, email or id. Open an account to see its profile, posts, comments, activity timeline, moderation history and notes, and to act on it.
- **Content**: every post and comment, with removal.
- **Events**: post updates, events and alerts. They appear at the top of everyone's feed. Optionally also send an alert to everyone.
- **Inbox**: reports from people, and appeals from banned or restricted accounts.
- **Control**: every action every admin took, with undo. "Undo everything" rolls back one admin's work.
- **Audit log**: everything done in the console, append-only, filterable, exportable.
- **Team** (owner): add admins, change roles, reset passwords, end sessions.
- **Settings** (owner): restriction length, strike rules, reason templates, idle sign-out.
- **System**: database and server health.

## Roles

| | Moderator | Admin | Owner |
|---|---|---|---|
| View users, content, reports | yes | yes | yes |
| Warn, restrict, lift, strike, remove content, notes | yes | yes | yes |
| Undo | own actions | anyone's | anyone's |
| Ban / unban, change email or password, delete account | | yes | yes |
| Events, appeals, audit log, system | | yes | yes |
| Team and settings | | | yes |

## Privacy

Admins cannot read private messages. There is no endpoint for it. The dashboard only counts messages.
