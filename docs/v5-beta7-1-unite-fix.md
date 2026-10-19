# Beta 7.1: relocated chunk tables with UNITE

The user reported successful soundtrack-only playback in Beta7, but an error
before launch with UNITE. The previous manager tab did not persist its log;
the actual saved configuration selected UNITE Heat 3.5 and the full soundtrack.

## Reproduction and cause

Reapplied that selection with the packaged Frosty GPL runtime in an isolated
workspace game mirror, without launching the game. Frosty completed successfully.
All seven Patch music entries retained their original audio locations but moved
within the rebuilt TOC. For example, GOKU moved from byte 495388 to byte 357096.
The Beta7 overlay required the original table position and would reject it as
`Patch chunk table changed`. This is an installer assumption, not evidence of
corrupt UNITE audio. The exact prior UI error is unavailable after window closure.

## Fix

- Resolve both Data and Patch destination entries by unique chunk GUID in the
  staged table. Use original positions only to verify the prepared build against
  the original game. Never write a stale original offset into the rebuilt table.
- Keep catalog validation, original identity checks, Data audio conflict checks,
  bounded CAS ranges and final audio hashes. Missing or duplicate GUIDs still fail.
- Save manager events/errors to timestamped files next to its configuration in
  `output/frosty-v5-session/logs`.
- Use a separate `HeatMusicV5Beta7_1Unite` game profile to preserve the working
  soundtrack-only Beta7 profile.

## Tests

`TestV5RelocatedToc.js` invokes the production overlay with reordered Data and
seven Patch entries. It checks final audio, unchanged non-music table bytes and
source CAS files, rejects missing/duplicate GUIDs, real Data conflicts and stale
original identities, and exercises persisted errors through the real manager.

### Completed real-file checks

- Reproduced Frosty assembly with exactly the user's selected UNITE Heat 3.5
  component and prepared Skrillex soundtrack; no Arcade/Stance extras were selected
  in that failed configuration. Frosty returned zero.
- Applied the corrected overlay from the newly compiled portable package to that
  isolated combined profile: **199/199 resources** validated (192 Data + seven Patch).
- An independent TOC/CAS reader, without FrostySdk or production resolver imports,
  confirmed **199/199 payload hashes**, **7/7 Patch hashes**, zero wrong catalogs
  and no duplicate Data music GUIDs in Patch chunk tables.
- Byte comparisons against the UNITE profile before the overlay found zero
  changes outside the 192 Data and seven relocated Patch music location records.
  All four destination CAS prefixes were preserved byte-for-byte by hash.
- Before/after hashes of both original chunk TOCs, the original Patch layout and
  four original CAS files matched. All six writable test destinations were
  detached into independent copies before applying the overlay.
- `TestV5CasAddress.js`, `TestV5Coverage.js` and `TestV5RelocatedToc.js` passed.

The packaged executable was compiled and the soundtrack reused, not reconverted.
The real-file run exercised Frosty assembly and the packaged overlay separately;
it did not press the UI Launch button, run the game, or test Arcade/Stance extras.
No combined-profile gameplay test or graphics fix is claimed. This remains a
test release using the custom GPL manager, not official FMM 1.0.6.3 compatibility.
