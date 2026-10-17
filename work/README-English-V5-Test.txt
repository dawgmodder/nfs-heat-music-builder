NFS HEAT MUSIC BUILDER V5 BETA 3

This test build uses its own manager based on the current GPLv3 Frosty source. It is not a claim of compatibility with the official Frosty Mod Manager 1.0.6.3.

WORKFLOW
1. Select the NFS Heat folder and build or import your soundtrack.
2. Open Mods & Launch.
3. Import the original UNITE .fbpack directly, or add individual .fbmod files.
4. Check the components you want and adjust their order. Handling and stance alternatives are mutually exclusive.
5. The custom soundtrack is always applied last.
6. Click APPLY MODS AND LAUNCH.

Importing only records the package and selection. Launch prepares a temporary profile, validates it, preserves the previous working profile on failure or cancellation, then starts NFS Heat with ModData/HeatMusicV5.

Steam installations are launched through Steam AppID 1222680 so the dataPath reaches the game. The package includes Frosty's GPL-distributed CryptBase launch shim and copies it beside the game executable only when it is absent; an existing file is never overwritten. EA App-only installations receive both -dataPath and GAME_DATA_DIR, but still require separate gameplay confirmation.

FIRST RUN
Internet access may be required by the existing audio setup to obtain its separately distributed conversion dependencies. The NFS Heat encryption key is extracted from the user's installed copy of the game and is never included in this package.

Beta 2 creates a verified portable baseline from the player's own original game files on the first build. It no longer requires a ModData folder made by an older Music Builder version. The baseline is reused on later builds. Playlist exit-marker behavior is also updated so a custom song is not cut after roughly 18 seconds when the same source is assigned to every slot. Race-intro timing markers are preserved.

LICENSES AND SOURCE
Application source and Frosty integration changes are published with the repository. Frosty GPL notices and the pinned-source patch are included in licenses and source. No UNITE files, user music, game files, encryption keys, caches or generated profiles are distributed here.

TEST STATUS
Automated tests cover direct UNITE FBPACK parsing, selection/order persistence, cache reuse, transactional cancellation/failure and 199/199 soundtrack payload hashes. Gameplay validation remains required before this build is promoted to stable.
