# NFS Heat Music Builder

Independent community tool. Not affiliated with or endorsed by EA.

## V4.3: official Frosty companion (integration candidate)

V4.2's standalone FBMOD path did not correctly apply Heat's global audio chunks in Frosty Mod Manager 1.0.6.3. This version exports an FBMOD **and** a required `.music` companion. Apply the FBMOD last in official Frosty, let it generate its profile, close the game, then use **Finish Frosty** in Music Builder. The finalizer creates a separate combined ModData profile without patching the original game, the source Frosty profile, or any Frosty DLL. Use **Start combined game**, not Frosty's Launch button, after finalization.

The finalizer resolves and verifies all 199 payload hashes, preserves other mod files, refuses stale profiles at launch, and supports safe cancellation and archive rollover. See [V4.3 instructions](work/README-English-V4_3.txt). This is not a claim of in-game or UNITE gameplay compatibility: both still need testing.

Validation: synthetic regression tests, UI creation/render checks, and a read-only regression using a real previously converted 199-wave build plus actual Frosty-generated output. An independent TOC/CAS audit found 199 matching replacements and zero invalid locations. No audio reconversion or game launch was performed. Private test data is not included.

Run `node work/TestFrostyCompanion.js` for synthetic tests; compile the Windows UI with `node work/CompileV43.js`. Packaging still requires the local runtime/manifests described below.

## Source baseline: V4.1

This import preserves the current Windows Forms interface, audio builders,
validation/cache code, portable setup scripts and selected smoke tests.
The historical V3 class/file names remain for compatibility.

No music, presets, caches, game files, encryption keys, credentials or compiled
third-party tools are included. Source integrity is preserved from the development
workspace. Some development defaults still reference its original Windows paths.

## Build limitations

This is a source baseline, not yet a reproducible clean-machine distribution.
The UI can be compiled on Windows with .NET Framework via work/compile-v4.ps1.
Native/Frosty helper builds require the separately obtained Frosty SDK/runtime.
The packaging script also expects local output manifests, inventory and a verified
Node binary not included in this source-only import. Do not interpret this
repository as containing a ready-to-run installer.

See work/README-English.txt for application usage and existing limitations.
Selected checks: work/TestV327.js and work/test-v4.ps1. UI smoke tests do not
validate in-game timing, playback or Windows notification delivery.

## Version control

Use commits for reviewed changes and version tags only for verified version
baselines. Never bulk-add the original development workspace or private data.
No historical commits or tags are fabricated for earlier versions.
