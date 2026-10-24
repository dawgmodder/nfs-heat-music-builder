# V5 staging links / language error (2026-10-24)

The default-garage diagnostic failed with an EA installed-language warning;
vanilla worked and Steam still selected English. No language/account changes
were made.

## Confirmed filesystem defect

The generated Data/Win32/loc and Data/Win32/levels junctions pointed to the
old `.HeatDefaultGaragePriorityTest-building-*` directory. Both were dangling.
The two English localization files and four level files existed in the original
game and previous profile, with matching hashes.

The overlay cloned only catalog ancestors physically. Untouched directories
were junctions into the source Data tree. When Frosty materialized Data (rather
than linking it to the original game), replacing Data deleted those source
directories; publishing staging also invalidated absolute staging references.
Audio-only checks did not detect this defect. This is distinct from the UNITE
garage lighting issue and is not evidence that the lighting issue is fixed.

## Fix

- Materialize all Data directories, resolve source links, hard-link files or
  copy across volumes; never link directories into disposable staging Data.
- Reject unreadable/cyclic/temporary-dependent profile links.
- Check coverage of the original Data/Patch files without requiring modded
  bytes to equal vanilla.
- Validate before and after publication. On final validation failure, move
  the candidate back to staging and restore the previous profile.
- Retain uniquely named previous-profile backups instead of deleting them.
- Include HeatProfileFiles.js in the portable package allowlist.

## Executed validation

Nine regression tests import the production helper: source removal/publication,
source junction resolution, simulated cross-volume fallback, dangling links,
live staging links, rollback after publication failure, cycles, integration
wiring, and missing localization coverage. They passed both against repository
code and deployed package scripts. Cross-volume fallback is fault-injected;
the current repair also copied six real files from C: to D:.

The existing diagnostic profile was repaired without re-encoding or rebuilding
CAS. Its broken junctions were moved to a backup outside the active profile;
replacement files matched vanilla and the previous profile. Final checks:
157 readable profile files, zero links inside the profile, all 153 original
Data/Patch file paths available, and 199/199 audio payloads valid. Originals and
the previous installed profile were not changed. The user-facing junction to
the D: profile and existing diagnostic launcher remain in place.

The independent bundle audit was repeated: all 17 garage-addon resources match
in 134 occurrences; garage soundtrack metadata retains the selected priority.
The broader audit still has the previously recorded Aventador alias mismatch
(35,924/35,925 matching), with zero read errors. This hotfix does not resolve
that separate discrepancy or claim a completely matching UNITE bundle audit.

No C# or Frosty runtime changes were needed: the existing executable invokes
the updated external JavaScript pipeline. This is a local diagnostic hotfix,
not a new release. No game launch/playback or garage visual validation was
performed by the agent. The user must repeat the diagnostic launch.
