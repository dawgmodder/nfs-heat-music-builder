# NFS Heat Music Builder

## V5 test branch

V5 uses an integrated manager based on the current GPLv3 Frosty pipeline. The intended workflow is: build one soundtrack FBMOD, import the original UNITE FBPACK, select its components, and use one Launch action. It does **not** claim compatibility with official Frosty Mod Manager 1.0.6.3.

Direct parsing of the original UNITE 3.5 Standard Pack, component ordering, mutually exclusive Handling/Stance alternatives, transactional profile replacement, safe cancellation, cache reuse and state persistence are implemented. The custom soundtrack is always applied last. Automated validation of the combined profile matched all 199/199 expected soundtrack payload hashes. Gameplay testing is still required before a stable release.

See [V5 validation](docs/v5-validation.md) and [Frosty GPL integration](frostygpl/README.md) for the exact test boundary, pinned upstream revision, reproducible patch and license obligations.

Independent community tool. Not affiliated with or endorsed by EA.

## Archived V4.3 companion path

V4.2's standalone FBMOD path did not correctly apply Heat's global audio chunks in Frosty Mod Manager 1.0.6.3. This version exports an FBMOD **and** a required `.music` companion. Apply the FBMOD last in official Frosty, let it generate its profile, close the game, then use **Finish Frosty** in Music Builder. The finalizer creates a separate combined ModData profile without patching the original game, the source Frosty profile, or any Frosty DLL. Use **Start combined game**, not Frosty's Launch button, after finalization.

The old finalizer is retained only for source history. V5 replaces this multi-step workflow. See [V4.3 instructions](work/README-English-V4_3.txt).

Validation: synthetic regression tests, UI creation/render checks, and a read-only regression using a real previously converted 199-wave build plus actual Frosty-generated output. An independent TOC/CAS audit found 199 matching replacements and zero invalid locations. No audio reconversion or game launch was performed. Private test data is not included.

Run `node work/TestFrostyCompanion.js` for synthetic tests; compile the Windows UI with `node work/CompileV43.js`. Packaging still requires the local runtime/manifests described below.

## Source baseline: V4.1

This import preserves the current Windows Forms interface, audio builders,
validation/cache code, portable setup scripts and selected smoke tests.
The historical V3 class/file names remain for compatibility.

No music, presets, caches, game files, encryption keys, credentials or compiled
third-party tools are included. Source integrity is preserved from the development
workspace. Some development defaults still reference its original Windows paths.

## Build and distribution limitations

The Windows UI is compiled with `node work/CompileV43.js`. The V5 portable package
is assembled with `node work/BuildV5PortablePackage.js`; that packaging step expects
the pinned Frosty build, a .NET 8 runtime and previously verified baseline tools on
the development machine. These third-party binaries are not committed to Git.

See work/README-English.txt for application usage and existing limitations.
Selected checks: work/TestV327.js and work/test-v4.ps1. UI smoke tests do not
validate in-game timing, playback or Windows notification delivery.

## Version control

Use commits for reviewed changes and version tags only for verified version
baselines. Never bulk-add the original development workspace or private data.
No historical commits or tags are fabricated for earlier versions.
