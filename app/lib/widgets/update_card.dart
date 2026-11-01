import 'package:flutter/material.dart';
import '../services/update.dart';
import '../theme.dart';
import 'clay.dart';

/// Floating card shown over any screen when this install is older than the
/// version the admins published. Close hides it until the next launch; "Don't
/// show again" hides it for that version only.
class UpdateCard extends StatelessWidget {
  const UpdateCard({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: UpdateService.I,
      builder: (context, _) {
        final u = UpdateService.I;
        if (!u.visible) return const SizedBox.shrink();
        return Positioned.fill(
          child: SafeArea(
            child: Align(
              alignment: Alignment.bottomRight,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 380),
                  child: Material(
                    color: Colors.transparent,
                    child: ClayCard(
                      padding: const EdgeInsets.fromLTRB(18, 14, 8, 14),
                      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Padding(padding: EdgeInsets.only(top: 2), child: Icon(Icons.system_update_alt, size: 20, color: C.honeyDeep)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              const Text('Update available', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15.5)),
                              const SizedBox(height: 2),
                              Text('Version ${u.latest} is ready. You have ${u.current}.', style: const TextStyle(color: C.inkSoft, height: 1.3, fontSize: 13.5)),
                              if (u.notes.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(u.notes, style: const TextStyle(height: 1.35, fontSize: 13.5)),
                              ],
                            ]),
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            onPressed: u.close,
                            icon: const Icon(Icons.close, size: 20, color: C.inkSoft),
                          ),
                        ]),
                        const SizedBox(height: 12),
                        Padding(
                          padding: const EdgeInsets.only(right: 10),
                          child: ClayButton(label: 'Download New Version', onPressed: u.download),
                        ),
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton(
                            onPressed: u.dontShowAgain,
                            style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4), minimumSize: const Size(0, 32)),
                            child: const Text("Don't show again", style: TextStyle(color: C.inkSoft, fontWeight: FontWeight.w700, fontSize: 13)),
                          ),
                        ),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
