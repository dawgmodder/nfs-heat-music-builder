NFS HEAT MUSIC BUILDER V5 TEST

This test build uses its own manager based on the current GPLv3 Frosty source. It is not a claim of compatibility with the official Frosty Mod Manager 1.0.6.3.

WORKFLOW
1. Select the NFS Heat folder and build or import your soundtrack.
2. Open Mods & Launch.
3. Import the original UNITE .fbpack directly, or add individual .fbmod files.
4. Check the components you want and adjust their order. Handling and stance alternatives are mutually exclusive.
5. The custom soundtrack is always applied last.
6. Click APPLY MODS AND LAUNCH.

Importing only records the package and selection. Launch prepares a temporary profile, validates it, preserves the previous working profile on failure or cancellation, then starts NFS Heat with ModData/HeatMusicV5.

FIRST RUN
Internet access may be required by the existing audio setup to obtain its separately distributed conversion dependencies. The NFS Heat encryption key is extracted from the user's installed copy of the game and is never included in this package.

LICENSES AND SOURCE
Application source and Frosty integration changes are published with the repository. Frosty GPL notices and the pinned-source patch are included in licenses and source. No UNITE files, user music, game files, encryption keys, caches or generated profiles are distributed here.

TEST STATUS
Automated tests cover direct UNITE FBPACK parsing, selection/order persistence, cache reuse, transactional cancellation/failure and 199/199 soundtrack payload hashes. Gameplay validation remains required before this build is promoted to stable.
