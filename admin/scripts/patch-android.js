// Run after `npx cap add android`. Small hardening for an admin tool:
//  - FLAG_SECURE: blocks screenshots and hides the app in the recents screen
//  - no cleartext traffic, no backups of app data
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'android', 'app', 'src', 'main');
const manifest = path.join(root, 'AndroidManifest.xml');
let m = fs.readFileSync(manifest, 'utf8');
if (!m.includes('usesCleartextTraffic')) m = m.replace('<application', '<application android:usesCleartextTraffic="false"');
m = m.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
fs.writeFileSync(manifest, m);

function find(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = find(p); if (r) return r; } else if (e.name === 'MainActivity.java') return p;
  }
  return null;
}
const main = find(path.join(root, 'java'));
if (!main) throw new Error('MainActivity.java not found');
let j = fs.readFileSync(main, 'utf8');
if (!j.includes('FLAG_SECURE')) {
  j = j.replace(/public class MainActivity extends BridgeActivity \{\s*\}/, `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE, android.view.WindowManager.LayoutParams.FLAG_SECURE);
    }
}`);
  if (!j.includes('FLAG_SECURE')) throw new Error('Could not patch MainActivity');
  fs.writeFileSync(main, j);
}
// every build gets a higher versionCode, otherwise Android refuses to install it over the old one
const gradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
const code = Number(process.env.GITHUB_RUN_NUMBER || 1) + 100;
g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`);
fs.writeFileSync(gradle, g);
console.log('android patched, versionCode', code);
