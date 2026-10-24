# V5 Beta 7.3

## Changes
- Present conventional bottom-wins order in the UI; reverse it once at the
  pinned GPL executor boundary (which keeps the first ordinary resource).
- Keep the soundtrack at highest priority, without mutating the user's list.
- Explain how to opt into the official Default Garage addon. Do not bundle it,
  auto-add it, or require it for users whose UNITE garage renders normally.
- Include the staging-directory repair and before/after publication validation.
- Use a separate `ModData/HeatMusicV5Beta7_3` profile and bundled relative runtime
  paths. No diagnostic launcher or D: game-input mirror is required.

## Evidence and limits
The user confirmed the prior isolated combination worked after its dangling
language/level links were repaired: UNITE + official Default Garage + soundtrack.
That is user gameplay evidence for that combination, not a test on every PC or
new gameplay confirmation for this packaged build. The cause of UNITE's custom
garage rendering problem remains unresolved. Official Frosty 1.0.6.3 export
compatibility and EA App gameplay are not claimed.

Tests and package validation results are recorded in the delivery report. The
existing independent bundle audit has one known Aventador-alias discrepancy
(35,924/35,925 match), separate from the garage/music resources. Custom-handler
conflict merging is not covered by the ordinary resource priority guarantee.

No music, UNITE packages, game files, keys, machine state or caches belong in the
distribution. Conversion tools may still be downloaded by first-run audio setup.

## Executed delivery checks — 2026-10-24

- Windows x64 executable compiled successfully.
- Nine production-helper filesystem regressions passed, plus order/optional
  addon/duplicate-selection tests.
- A separate folder with spaces and cleared HEAT_MUSIC/GAME_DATA_DIR variables
  loaded the bundled Node/.NET runtimes and constructed the real WinForms UI.
  This is an initialization smoke test, not a visual interaction test.
- The executable's FBPACK importer read and extracted all five components of
  the user's original UNITE Standard Pack into private QA storage.
- The relocated manager assembled a new profile against the actual installed
  game, without a mirrored game-input folder or a diagnostic launch CMD.
  Inputs were original UNITE, optional Default Garage and an existing exported
  soundtrack/prepared audio. No audio re-encoding or game launch occurred.
- Final profile: 199/199 audio payloads, 157 readable files, zero internal links,
  and all 153 original Data/Patch paths covered. Fourteen monitored original and
  previous-profile files remained unchanged (not a full game integrity check).
- Independent bounded TOC/SB/CAS inspection: all 17 addon resources matched in
  134 occurrences, and garage music metadata retained soundtrack priority.
  The broader audit still has the known Aventador alias mismatch above.
- Package audit rejects private/generated payloads and missing local modules.
  Frosty DLL hashes match the previously tested runtime. The package has no
  personal WIN10/development-folder fallback paths in its text files.

The first QA attempt incorrectly supplied an already converted internal FBMOD;
it failed before profile publication. Repeating with the original exported mod
succeeded. The manager now reports a missing converter output explicitly instead
of failing later with an opaque rename error.

Not re-tested: first-run Internet downloads, new audio conversion, EA App-only
gameplay, or a complete in-game session with this newly packaged executable.
The distribution remains a beta. Do not distribute the private QA folder.
