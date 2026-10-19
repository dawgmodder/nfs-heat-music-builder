# Beta 7 — full coverage for a single song

## User reproduction and confirmed observations

The user's actual Beta6 profile was inspected after their test: soundtrack alone,
no UNITE, 19/19 final addresses and payload hashes correct, no wrong catalogs.
Only five of those resources were original playlist tracks (one per context).
All other playlist slots were untouched. This explains why original tracks can
still be selected, but does not prove gameplay of the five replacements.

## Changes

- Both automatic and edited/imported plans now call the full playlist/intro
  builder regardless of source-song count.
- Full coverage is validated against the inventory, by name and GUID: 71 playlist
  resources (including garage/loading variants), 126 intro segments, two menu
  resources, 192 Data + seven Patch. Duplicates and missing slots are rejected.
- Coverage checks run before export and before Frosty assembly. Old 19-resource
  exports cannot silently be reused as a complete soundtrack.
- A new `HeatMusicV5Beta7FullPlaylists` profile keeps earlier profiles intact.
- The catalog address fix and final-TOC validation from Beta6 remain in place.

## Validation status

`TestV5Coverage.js` covers complete inventory, partial builds, duplicates, wrong
GUIDs, a missing loading variant, and both planner routes. `TestV5CasAddress.js`
covers the production address writer/validator and invalid-address cases.

The existing Skrillex library and 41.5-second UI drop marker are used for the
local reproduction build. Reusable audio stays cached; sequence-specific intro
cuts may require encoding. Completed build and assembly results are recorded
below. No gameplay approval is implied by file checks.

### Completed on 2026-10-18

- Built `HeatMusic_20261018221111_b644eb`: 192 Data + seven Patch resources.
  All 71 playlist slots reference the same full 273.768-second custom audio,
  rather than an intro cut. Menu and race-intro segments remain separate.
- Compiled `HeatMusicInstallerV5Beta7.exe` and prepared clean/local packages.
  The local package's 199 prepared audio hashes and current modules were checked.
- Applied the exported mod using the packaged Frosty GPL runtime in an isolated
  workspace game mirror. Assembly completed with exit code zero; no game launch.
- Independently read the final TOC entries, catalog IDs and bounded CAS ranges
  without FrostySdk/AssetManager: **199/199 payload hashes match**, including
  **7/7 Patch resources**, zero wrong catalogs and zero Data TOC byte changes
  outside the intended audio entries. This is an address/payload audit, not a
  claim that every unrelated game resource has been audited.
- The packaged production validator also accepted all 199 final payloads.
- SHA-256 before/after checks matched for the original Data/Patch chunk TOCs,
  Patch layout and four source CAS files used by the overlay.
- Export SHA-256:
  `21d8c8e7e68d3328fac684fc76ad99b709de4b3a4c9ead766941232fec60d421`.
- Executable SHA-256:
  `906761fa1ebd12b9a8d1448143dbc3df78ebaca3b97fcb70c41658eafa6e63b3`.

The disposable assembled mirror profile is removed after retaining audit
reports and TOC evidence to recover test disk space. User profiles, music,
presets and caches are not removed. The local prepared test includes user audio
and a local key and must not be distributed; the separate clean package does not.

## Acceptance still requiring gameplay

Launch the prepared soundtrack alone first. The five gameplay playlists should
now use the selected song rather than uncovered originals. Let it finish and
check automatic progression/manual skip, garage/loading, free drive day/night,
race day/night, menu and race intros. Only then test UNITE separately. The prior
white/pink garage issue is not diagnosed by this change. The user confirmed
normal garage colors with UNITE disabled; this does not isolate the cause of
the earlier combined-profile graphics issue. No Beta7 gameplay test or combined
UNITE test has been performed or claimed.
