import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config.dart';

/// Asks the server which version is the newest (set by the admins in the admin
/// console) and tells the UI when this install is older. Same for every platform.
class UpdateService extends ChangeNotifier {
  UpdateService._();
  static final UpdateService I = UpdateService._();

  static const _dismissedKey = 'update_dismissed_version';

  String? latest;
  String notes = '';
  String downloadUrl = 'https://helphive.freedev.app';
  String current = '';

  bool _dismissedForever = false;
  bool _closedThisRun = false;
  Timer? _timer;

  bool get outdated => latest != null && current.isNotEmpty && compareVersions(current, latest!) < 0;
  bool get visible => outdated && !_dismissedForever && !_closedThisRun;

  Future<void> start() async {
    if (!Config.ready) return;
    await check();
    _timer ??= Timer.periodic(const Duration(minutes: 30), (_) => check());
  }

  Future<void> check() async {
    try {
      final res = await http.get(Uri.parse('${Config.apiUrl}/app-version')).timeout(const Duration(seconds: 20));
      if (res.statusCode != 200) return;
      final j = jsonDecode(res.body) as Map<String, dynamic>;
      current = (await PackageInfo.fromPlatform()).version;
      latest = j['latestVersion'] as String?;
      notes = (j['notes'] as String?) ?? '';
      final url = j['downloadUrl'] as String?;
      if (url != null && url.startsWith('https://')) downloadUrl = url;
      final prefs = await SharedPreferences.getInstance();
      // "don't show again" belongs to one version, so a newer release shows the card again
      _dismissedForever = latest != null && prefs.getString(_dismissedKey) == latest;
      notifyListeners();
    } catch (_) {
      // offline or server asleep: stay quiet, try again later
    }
  }

  /// Hides the card until the app is opened again.
  void close() {
    _closedThisRun = true;
    notifyListeners();
  }

  Future<void> dontShowAgain() async {
    final prefs = await SharedPreferences.getInstance();
    if (latest != null) await prefs.setString(_dismissedKey, latest!);
    _dismissedForever = true;
    notifyListeners();
  }

  Future<void> download() async {
    await launchUrl(Uri.parse(downloadUrl), mode: LaunchMode.externalApplication);
  }
}

/// -1 if a is older than b, 0 if equal, 1 if newer. Ignores any "+build" or "-tag" part.
int compareVersions(String a, String b) {
  List<int> parts(String v) {
    final core = v.split(RegExp(r'[+-]')).first.trim();
    final nums = core.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    while (nums.length < 3) {
      nums.add(0);
    }
    return nums;
  }

  final x = parts(a), y = parts(b);
  for (var i = 0; i < 3; i++) {
    if (x[i] != y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}
