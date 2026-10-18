# Beta 6: CAS catalog address regression test

## Confirmed defect

Beta 5 wrote Data CAS 8 music into install catalog 1 while setting the TOC file
identifier's catalog byte to 0. Menu CAS 13/14 correctly used catalog 0. Of the
19 resources in the observed build, only the two menu resources resolved to the
expected bytes. Resolving catalog 1 in memory recovered all other audio hashes.

The previous validator ignored this catalog byte and opened a writer-supplied
path. It therefore verified stored bytes, not the address the game receives.

## Changes

- Preserve the original catalog in Data addresses; obtain catalog paths from the
  final `Patch/layout.toc`, not from a CAS-number heuristic.
- Validate by GUID lookup, final file identifier, resolved CAS and exact bounded
  interval; never search another catalog when the actual address is invalid.
- Validate Patch addresses too, and fail closed if expected TOC identity changed.
- Materialize destination catalog directories before replacing archives, avoiding
  writes through directory junctions into the original game.
- Use a separate `HeatMusicV5Beta6AddressTest` profile for the test executable.

## Tests executed, 2026-10-18

- `node work/TestV5CasAddress.js`: production writer and validator integration;
  literal independent GUID fixture; catalog 0 and 1; Patch resolution; wrong and
  missing catalog; out-of-bounds and truncated CAS; wrong hash/GUID; uint32 limit;
  source TOC/CAS byte preservation. Passed.
- Read-only validation of the actual installed Beta 5 profile: correctly rejected
  its first non-menu resource with catalog 0 / CAS 8 and the exact address.
- Detached overlay application using the existing build
  `HeatMusic_20261018170901_37ecee`: 19/19 passed. No audio reconversion.
- Independent binary audit with no production-module or FrostySdk imports:
  19/19 effective addresses matched SHA-256; zero wrong catalogs; zero differences
  outside permitted music records in Data/chunks0.toc.
- SHA-256 of source Data/chunks0.toc and all three original destination archives
  before and after the detached test: unchanged.

## Explicit limits

No gameplay test performed. This does not establish a fix for all historical
silence reports. The white/pink garage issue remains unisolated. Full 199-resource
real-profile validation remains pending. The single-song path still replaces only
19 resources, not every playlist slot; restoring complete coverage is the next
separate change after this controlled address test.

The historical claim that the reduced 19-resource path reproduced the working
V4.1 configuration was incorrect: the historical profile modified all 70 Data
playlist entries examined. Historical hash counts alone are not gameplay proof.

## User acceptance

Test soundtrack alone first. When one of its replaced original tracks is chosen,
let the complete song finish, then check automatic progression and manual skip.
Test garage, free drive, race and intro contexts. Only then repeat with UNITE,
Arcade and Basic Stance. Keep the previous profile and caches intact.
