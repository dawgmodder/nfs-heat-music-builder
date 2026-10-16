# Frosty GPL integration

The V5 branch replaces the unsupported Frosty 1.0.6.3 global-chunk workaround with the current GPLv3 Frosty mod pipeline. The target workflow is:

1. Build one soundtrack `.fbmod` in Music Builder.
2. Select it together with UNITE or other Frosty mods.
3. Click **Launch** once in the integrated manager.

## Reproducible Frosty source

- Upstream: <https://github.com/FrostyToolsuite/FrostyToolsuite>
- Pinned commit: `ee2a587af394fc784b309bb7990dab051065330f`
- License: GNU GPL v3 (the upstream `LICENSE` file remains authoritative).
- Local changes: [`0001-heat-compiled-mod-and-windows-links.patch`](0001-heat-compiled-mod-and-windows-links.patch)

The patch enables compiled-mod application without generating a type SDK and adds a Windows link fallback (symbolic link, then hard link, then copy). This lets a normal non-administrator account build an isolated ModData directory.

To reproduce the engine, clone the pinned upstream commit, apply the patch, and build `FrostyCli` with the .NET 8 SDK. Distribution packages must include the GPL notice and make the complete corresponding Frosty source available.

## Current verification gate

The current prototype applied these four mods in one ordered profile:

- UNITE Heat 3.5
- Handling Overhaul 3.0 (ARCADE)
- UNITE Basic Stance 2.0
- Heat custom soundtrack (199 audio resources)

The isolated output contained all 199 soundtrack replacements with zero original pointers, zero missing Patch entries, zero invalid CAS locations, and zero wrong-catalog matches. This proves combined profile generation; it is not yet a claim that the game was launched or played.

The first offline audit incorrectly passed the complete remainder of each CAS file to `Cas.DecompressData`. Because the decoder reads to the end of its stream, it crossed the selected resource boundary and could fail with an access violation. The corrected auditor copies exactly the validated `offset + compressed size` range into a bounded `BlockStream` before decoding.

With that correction, all **199 of 199** soundtrack resources in the generated UNITE + music profile decompressed successfully and matched their expected SHA-256 hashes (`Errors = 0`). The reusable auditor source is in [`FrostyPayloadAudit`](FrostyPayloadAudit); copy that directory beside `FrostySdk` in the pinned Frosty checkout to build it. This proves payload integrity of the generated profile, but it remains separate from in-game playback testing.
