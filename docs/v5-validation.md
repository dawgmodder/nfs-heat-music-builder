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
- Playlist graph regression: all 71 licensed wave assets resolved across 74 segment references in four music graphs; exit-marker transitions were disabled only for those references. All 199 audio resources exported and the resulting FBMOD passed structural validation.
- Steam launch plan: passed AppID 1222680, `-dataPath` forwarding and unsafe-path rejection; the real Steam/EA launch created a running NFS Heat process.

## Not yet claimed

The Steam + EA App installation launched with the combined UNITE + soundtrack profile, and the user reported that it worked. This is a user-reported gameplay result rather than an automated assertion. The Beta 2 fixes still require gameplay confirmation, and EA App-only installation remains untested.
