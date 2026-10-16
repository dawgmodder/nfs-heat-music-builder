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

## Not yet claimed

The automated checks do not prove gameplay. Menu, entering the world, garage, playlists and race intros must be tested in the game before V5 is promoted from a test build.
