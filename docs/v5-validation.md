# V5 validation record

This record distinguishes automated validation from gameplay testing. It contains no user music, game data, keys, or extracted UNITE components.

## Original FBPACK

- Input SHA-256: `e583ef12958dc3c77b7f997820231ad3130381937bc2f2e6235b4c702af49d77`
- Format: ZIP container with a version 1 `manifest.json`; the manifest order is authoritative.
- Package name: `UNITE STANDARD`
- Declared manager version: `1.0.6.2`
- Ordered components: UNITE Heat 3.5; Handling Overhaul SIMCADE; Handling Overhaul ARCADE; UNITE Extreme Stance; UNITE Basic Stance.
- Default test selection: UNITE Heat 3.5; ARCADE; Basic Stance. Soundtrack applied last.

## Automated results

- Direct import from the original `.fbpack`: passed.
- Manifest order and safe component extraction: passed.
- Music-only profile: passed structural generation.
- Selected UNITE-only profile: passed structural generation.
- Selected UNITE + soundtrack profile: passed structural generation.
- Second execution: reused four compatible updated-FBMOD cache entries.
- Changed component order: passed structural generation.
- Safe cancellation: retained the previous active profile.
- Simulated Frosty failure: retained the previous active profile.
- Reopen: restored selected items, load order and soundtrack.
- Generated UNITE + soundtrack payloads: 199/199 decompressed hashes matched, 0 errors.
- Clean-install portable baseline: created from verified original game files and reused on a second run.
- Playlist graph regression: all 71 licensed wave assets resolve across 74 segment references in four music graphs. The originals already use `TriggerNextPlayableOnExitMarker=false`; Beta 4 preserves that metadata instead of rewriting it.
- Independent TOC/CAS comparison proved that the Beta 3 Manifest2019 precedence change altered only the SDK auditor's interpretation. The previous and current V5 game payloads were byte-identical, so that change did not fix playback.
- Layer regression: the failed V5 FBMOD routed all 199 streamed music chunks through Patch. The original game and the working V4.1 layout use 192 Data chunks and 7 Patch chunks. Beta 4 exports a metadata-only FBMOD (`200 EBX`, `199 RES`, `0 CHUNK`) and transactionally merges audio into its original layers.
- One-song regression: 71 playlist slots use one complete 273.768-second payload; full decode contains audible beginning, middle and end with no one-second silence. The assembled profile validated all 199 exact CAS intervals (`192 Data + 7 Patch`) twice, including a compatible-cache run.
- Multi-song regression: a 51-distinct-playlist-audio build validated all 199 exact CAS intervals.
- UNITE regression: direct import of the original FBPACK with UNITE Heat 3.5, ARCADE and Basic Stance plus the soundtrack validated all 199 intervals. Legitimate Patch relocation by Frosty is accepted only after the original TOC identity and final payload are validated.
- Steam launch plan: passed AppID 1222680, `-dataPath` forwarding and unsafe-path rejection; the real Steam/EA launch created a running NFS Heat process.

## Not yet claimed

The earlier combined UNITE + soundtrack version was reported working by the user, but the Beta 4 layer-preserving fix has not yet been played in game. It must be tested beyond the former silence point, through the end of the song, automatic advance and manual skip. EA App-only installation remains untested.
# Correction notice — Beta 6, 2026-10-18

The historical validation results below are not proof of correct CAS addressing
or gameplay. The previous overlay validator omitted the install-catalog byte.
See [Beta 6 address regression](v5-beta6-address-test.md) for the confirmed defect,
the corrected checks, and explicit pending in-game/full-coverage tests.
