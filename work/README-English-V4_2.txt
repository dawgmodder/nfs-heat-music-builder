NFS Heat Music Builder V4.2

V4.2 exports a standalone Frosty FBMOD containing the custom EA Layer3 audio
and the matching game metadata. It does not install a ModData overlay or start
the game.

Build and use
1. Run HeatMusicInstallerV4_2.exe and select your NFS Heat installation.
2. Select one folder containing the music files.
3. Analyze the library, review playlists and drop markers, then choose Build and
   Export Mod.
4. Find the exported FBMOD under output/exports.
5. Import that FBMOD into Frosty Mod Manager. Enable it alongside your other
   mods and launch NFS Heat from Frosty Mod Manager.

The first run downloads the required Frosty runtime, EA Layer3 converter and
FFmpeg tools. Downloads are checked against pinned SHA-256 values where the
publisher provides a stable archive. The game encryption key is obtained from
the selected local game installation; it is not included in the package.

Compatibility
The FBMOD contains 199 replacement audio assignments and their NewWave metadata.
Mods that change the same audio chunks or music graph assets can conflict, and
the Frosty Mod Manager load order determines which version is applied. Test the
selected mod combination before sharing a loadout. UNITE and other third-party
mods are not included in this package.

The build process does not modify the original game Data or Patch files and
does not create or replace the game's ModData folder. Keep the exported FBMOD
and the source music separate from the portable program folder as desired.
