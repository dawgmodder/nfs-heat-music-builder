NFS HEAT MUSIC BUILDER V5 BETA 7.3

This is a beta, not a stable release. It uses its own manager based on GPLv3
Frosty. Compatibility with official Frosty Mod Manager 1.0.6.3 is NOT claimed.

QUICK START
1. Extract the entire package to a writable folder. Do not run inside the ZIP.
2. Run HeatMusicInstallerV5Beta7_3.exe and select your installed NFS Heat folder.
3. Choose your music or import a preset, configure tracks, then build the mod.
4. Open MODS & LAUNCH and import the original UNITE .fbpack directly, or add
   individual .fbmod files. Choose the components you want.
5. Lower entries in the list override upper entries. The soundtrack has highest
   priority automatically. Do not select conflicting handling/stance variants.
6. Click APPLY MODS AND LAUNCH. No separate CMD/finalizer is required.

OPTIONAL UNITE GARAGE WORKAROUND
Only if UNITE's garage appears white/pink, obtain the UNITE Team's optional
"Revert To Default Garage.fbmod" from their Optional Mods - Extras download.
Extract that download, use ADD FBMOD, place the addon BELOW the main UNITE mod,
and check it. Uncheck/remove it to keep UNITE's custom garage. This workaround
is optional, not automatically enabled, and the addon is not included here.
It worked in the reported installation; the cause of UNITE's rendering issue
and whether it affects other PCs are not established.

PROFILE AND BACKUPS
The app assembles ModData/HeatMusicV5Beta7_3. Existing earlier-version profiles
are not replaced. It validates audio, file access and game-file coverage before
and after publication. Failure restores the previous profile. Previous versions
of this profile are retained as uniquely named .previous-* backups; these can
use substantial disk space. Keep enough free space for assembly and backups.
Logs: output/frosty-v5-session/logs. Compatible audio conversions are reused.

FIRST RUN / REQUIREMENTS
Windows x64, .NET Framework 4.x, and a legitimate NFS Heat installation through
Steam or EA App are required. The Node/.NET 8/Frosty manager runtimes are bundled.
Internet access may be required to download separately distributed conversion
dependencies during audio setup. The game key and baseline are obtained from
the user's own installation, not included in this download.
Steam launches through AppID 1222680. EA App launch still needs separate gameplay
confirmation. Remove obsolete manual -dataPath launch options before using this
manager, so they do not conflict with its selected profile.

UPGRADING
Keep your old folder, music and presets. Use a preset exported with converted
audio to reuse compatible conversions in this new folder. Do not copy old
manager-config.json, ModData, runtime caches or diagnostic launch scripts.

SOURCE / LICENSES / TEST STATUS
Source: https://github.com/dawgmodder/nfs-heat-music-builder
See licenses/ and source/ for Frosty notices and reproducible changes.
No UNITE mods, music, keys, game files or generated profiles are distributed.
The ordinary EBX/RES/chunk priority rule is tested; mods with custom handlers
may require individual compatibility tests. See docs/v5-beta7-3.md for completed
checks and limitations. A successful build is not proof of gameplay correctness.
