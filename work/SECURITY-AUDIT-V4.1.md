# V4.1 distribution audit and Frosty migration investigation

Date: 2026-10-11. Status: investigation; **not a security-cleared replacement release**.

## Evidence

VirusTotal ZIP SHA256:
`0b1bc6b6b4609ccc38b58fae84f72f04dd4afcb8c0aa838acd4cc03adc3762c1`.
Observed reports: archive 4/65, installer 2/71, CreateNoLaunchFrostySupport 6/71.
Some other engines timed out. These counts are neither proof of malware nor proof
of safety and can change on rescanning. The entire archive's per-file reports
were not examined.

The local archive contents were inventoried. Bundled Node has a valid Authenticode
signature. The six first-party EXEs are unsigned.

All six first-party EXEs were compiled from local source into an isolated directory,
without executing installers or patching Frosty. Every byte matched the released
EXEs after normalizing only three documented legacy compiler fields:

- PE COFF timestamp;
- the sole CLR metadata GUID (module identifier);
- the GUID suffix of the compiler-generated PrivateImplementationDetails type
  name, when present, within the metadata strings heap.

No instruction bytes, embedded resources, ordinary strings, or appended data were
ignored. There are 24 passing comparison checks: six rebuilt matches, six raw
section mutations rejected, six appended overlays rejected, and six truncated
files rejected. This is a narrow provenance check, not a formal reproducible-build
claim or malware analysis. It assumes the local compiler and reference assemblies
are trustworthy. The initial rebuild emitted two PresentationCore architecture
warnings; references were then restricted to non-GAC_32 assemblies in the script.

Reproduce from the development workspace (requires its existing distribution,
icon, .NET Framework compiler and separately obtained Frosty references):

```powershell
powershell -NoProfile -File work/AuditReleaseSecurity.ps1
powershell -NoProfile -File work/RebuildSecurityAudit.ps1 -FrostyRuntime <runtime-directory>
node work/CompareAuditBinaries.js
node work/TestAuditBinaryComparison.js
```

Reports are under `output/security-audit-v4-1`. Rebuild refuses to overwrite an
existing evidence directory. These scripts do not make the source baseline a
standalone clean-machine build.

## Likely detection surface, not a confirmed engine explanation

CreateNoLaunchFrostySupport reads a hash-pinned Frosty DLL, uses reflection to locate
two IL call sites and writes a separately patched copy. It suppresses automatic
game launch and an informational first-install dialog; it does not disable UAC.
This is a plausible heuristic trigger. No antivirus vendor has confirmed that
these detections are false positives. Recompiling or signing alone does not resolve
the classification. Do not disable protection or add exclusions on this basis.

Other relevant surfaces remain: the application requests administrator privileges,
downloads tools, extracts the user's local game key, and uses Frosty's mod-loading
support. The old upstream executor can copy CryptBase.dll to the game directory.
The audit did NOT run that executor, upload binaries, alter game/ModData, install
certificates, buy signing services, or replace the existing release.

## GPLv3 migration investigation

Pinned upstream commit: `ee2a587af394fc784b309bb7990dab051065330f` in
<https://github.com/FrostyToolsuite/FrostyToolsuite>.

Positive: `FrostyModExecutor.GenerateMods` builds mod data without launching the
game. A migrated integration could remove CreateNoLaunchFrostySupport and the
patched NoLaunchRuntime altogether, rather than disguise them.

Not a drop-in replacement:

1. Upstream README describes an early .NET 8 rewrite without a stable release.
   The latest-release API returned 404 during inspection. The project explicitly
   directs stable users back to 1.0.6.3.
2. Old .NET Framework SDK namespaces/types and application initialization differ.
   Our metadata builder, apply helper, baseline and type-library integration need
   adaptation or a separate .NET 8 bridge.
3. CLI documentation requires updating 1.0.x FBMODs before use. The update command
   defaults to overwriting its input unless an explicit output is supplied.
4. A Heat profile exists, but that does not establish working Heat mod generation.
   Bundle format and generated EBX/chunk output must be checked against real data.
   The executor still has unimplemented cases for Kelvin/SuperBundleManifest;
   this audit has NOT established that Heat uses either of those cases.
5. CLI LoadGame asks for a running game's PID and dumps types if its new SDK is
   absent. Compatibility with our existing SDK is not established. A fully
   automatic no-game-running first setup is not proven.
6. GenerateMods recursively removes its destination if it exists. Any bridge must
   constrain this to a fresh, owned staging directory, never the game root, the
   installed mod, arbitrary user paths or symlink/junction destinations.
7. CLI ModGame logs failures without explicitly setting a nonzero exit code in
   that method. A bridge must propagate typed results and independently validate
   outputs, not equate process exit 0 with successful installation.
8. Upstream documents a CryptBase.dll requirement on Windows. Removing our patch
   does not remove every mod-loading component or guarantee zero AV alerts.
9. No .NET SDK was listed by `dotnet --list-sdks` on this machine. No GPLv3 Frosty
   build, mod generation, or in-game migration test was performed.

The old 1.0.6.3 README declares CC BY-NC-ND 4.0. Do not assume permission to ship a
modified legacy DLL. The new repository declares GPLv3. Before distributing a
migrated combined application, establish applicable licenses, attribution and
corresponding-source obligations for our code, upstream and all dependencies.
The user's authorization here is to investigate migration, not to silently
relicense unrelated code or accept third-party commercial terms.

## Required acceptance gates before a replacement release

- Pin and build the GPLv3 CLI/bridge with an available .NET 8 SDK; record all inputs.
- Verify Heat SDK generation and FBMOD conversion on copies only.
- Generate into a fresh disposable workspace path and validate catalog/TOC,
  chunk content and all tested music contexts before installation.
- Test end-of-track progression, skip, intro/drop timing, menu looping and garage
  transitions. No current result establishes these for the new backend.
- Remove legacy patcher from BOTH setup and the distribution allowlist only once
  the replacement works. Test that setup cannot silently fall back to it.
- Address least privilege, existing downloaded-tool integrity and preset/ZIP
  handling in the final release audit.
- Produce a clean package, checksums, matching source tag and license notices.
- Submit the exact candidate to affected vendors for classification review;
  record their responses. Signing requires the publisher's verified identity and
  certificate/service; none was acquired or configured in this investigation.

## Sources

- [Legacy license declaration](https://github.com/CadeEvs/FrostyToolsuite/blob/v1.0.6.3/README.md)
- [New upstream status](https://github.com/FrostyToolsuite/FrostyToolsuite/blob/ee2a587af394fc784b309bb7990dab051065330f/README.md)
- [GenerateMods](https://github.com/FrostyToolsuite/FrostyToolsuite/blob/ee2a587af394fc784b309bb7990dab051065330f/FrostyModSupport/FrostyModExecutor.cs)
- [CLI usage](https://github.com/FrostyToolsuite/FrostyToolsuite/blob/ee2a587af394fc784b309bb7990dab051065330f/FrostyCli/README.md)
- [CLI initialization](https://github.com/FrostyToolsuite/FrostyToolsuite/blob/ee2a587af394fc784b309bb7990dab051065330f/FrostyCli/Program.cs)
- [CLI mod/update handling](https://github.com/FrostyToolsuite/FrostyToolsuite/blob/ee2a587af394fc784b309bb7990dab051065330f/FrostyCli/Program.Mods.cs)
