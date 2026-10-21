# V5 Beta 7.2 — bundle SHA-1 indexing test

## Scope and evidence

The user confirmed that Beta 7.1 played the custom soundtrack with UNITE, but the
garage was white/pink. Music alone had normal garage graphics. This version does
not alter UNITE exposure, lights, materials or texture contents.

The original UNITE v5 FBMOD and its v6 conversion contain the same 9,009 resources.
Payloads and the compared runtime resource metadata were preserved (five embedded
preview-image size fields changed, not game assets). A fresh SDK audit of the
installed profile matched 9,002 modified payloads, skipped five embedded resources
and one localization handler, and could not resolve one Aventador EBX name alias.
That audit did **not** validate the serialized bundle SHA-1 table.

Further metadata checks found SHA-1 discrepancies for 39 EBX, all 285 RES and all
381 chunk entries in the SDK view. Chunk original-size fields in that view are
derived values and are not used as proof of a separate defect.

An independent Node reader then read the installed TOC/SB/CAS byte ranges without
using AssetManager or the patched SDK. Across 8,107 bundles, it checked 35,445
occurrences of UNITE resources and found **4,986 wrong SHA-1 entries**. This includes
the garage HDRI resources `garagepanocomp` and
`t_sky_floridastpeter_garagetest01_gradient`. Resource occurrences are not unique
files: the same texture is referenced by multiple bundles.

## Confirmed writer defect

`FrostyModSupport/BinaryBundle.cs` has a single SHA-1 table ordered as EBX, RES,
then chunks. The RES and chunk loops assigned `sha1[i]`, where `i` restarts at
zero for each resource type. They therefore overwrote preceding entries and left
the intended entries with old hashes. The file-location callbacks already used
the correct combined index `j`, explaining why payload checks passed.

The fix changes those two assignments to `sha1[j]`. The pinned-source patch
includes it. This is a confirmed serialization defect; whether it fully explains
the user's visual symptom remains subject to an in-game test.

## Regression and delivery

`frostygpl/BinaryBundleRegression` invokes the actual production writer and reads
the resulting hash table independently. It covers unchanged data, EBX-only,
RES-only, chunk-only, mixed edits, mixed edits with additions, callback alignment,
and preservation of input bytes. All six scenarios pass with the corrected DLL.
The same executable with the old Beta 7.1 DLL fails at `res SHA table slot 1`.

A fresh UNITE + soundtrack assembly was generated in an isolated workspace game
mirror, without launching the game. The independent reader checked the same
35,445 occurrences: **35,444 matched, one remained divergent, zero parse errors**.
All compared garage HDRI entries matched. The remaining entry is
`vehicles/player/car_lamborghini_aventadorlp7004_2014/car_lamborghini_aventadorlp7404sroadster_2018`,
the same name not resolved by the SDK audit. Its UNITE replacement remains an
open limitation; it is not hidden or counted as passing, and its relationship to
gameplay has not been established. The test originally requiring zero mismatches
failed on this entry, prompting this explicit investigation/report.

The production layered-audio writer was then applied to that scratch profile.
All **199/199** soundtrack resources passed final-address/payload validation, and
the independent bundle audit retained **35,444/35,445** matching occurrences (only
the same Aventador entry differed). SHA-256 checks of the six corresponding
original game TOC/CAS files were unchanged. No installed user profile was replaced.
Existing catalog-address, full-coverage and relocated-TOC regression tests passed.

Build the patched Frosty CLI, then build the regression project. Its
`FrostyBuildDirectory` MSBuild property can point at a different Frosty output.
Run the resulting .NET 8 test DLL. It needs no game files, music or encryption key.

The new launcher uses `ModData/HeatMusicV5Beta7_2Hashes` and logs SHA-256 identities
of the CLI, SDK and ModSupport assemblies. Earlier profiles are not replaced.
Already prepared soundtrack audio can be reused; this fix is applied during
profile assembly, not audio conversion.

### Gameplay acceptance still required

Test the prepared soundtrack with UNITE Heat selected and soundtrack last. Check
garage colors, entry into the world, a full song and automatic/manual transitions.
If graphics are still abnormal, compare UNITE alone in the official manager before
attributing the remaining issue to this defect. No game launch/playback test has
been performed by the automated regression.
