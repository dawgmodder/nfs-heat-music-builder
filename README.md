# NFS Heat Music Builder

Independent community tool. Not affiliated with or endorsed by EA.

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
