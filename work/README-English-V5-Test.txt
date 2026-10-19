NFS HEAT MUSIC BUILDER V5 BETA 7.1 — UNITE TABLE FIX TEST

This is a test build, not a stable release. It retains the catalog address fix and
retains full coverage for one-song libraries and resolves music entries by GUID
after UNITE/Frosty reorganizes chunk tables. See docs/v5-beta7-1-unite-fix.md.
Combined-profile gameplay and the earlier graphics issue still need confirmation.

This test build uses its own manager based on the current GPLv3 Frosty source. It is not a claim of compatibility with the official Frosty Mod Manager 1.0.6.3.

WORKFLOW
1. Select the NFS Heat folder and build or import your soundtrack.
2. Open Mods & Launch.
3. Import the original UNITE .fbpack directly, or add individual .fbmod files.
4. Check the components you want and adjust their order. Handling and stance alternatives are mutually exclusive.
5. The custom soundtrack is always applied last.
6. Click APPLY MODS AND LAUNCH.

Importing only records the package and selection. Launch prepares a temporary profile, validates it, preserves the previous working profile on failure or cancellation, then starts NFS Heat with ModData/HeatMusicV5Beta7_1Unite. Previous profiles are not replaced. Each assembly saves a timestamped log under output/frosty-v5-session/logs, including errors after the window is closed.

Steam installations are launched through Steam AppID 1222680 so the dataPath reaches the game. The package includes Frosty's GPL-distributed CryptBase launch shim and copies it beside the game executable only when it is absent; an existing file is never overwritten. EA App-only installations receive both -dataPath and GAME_DATA_DIR, but still require separate gameplay confirmation.

FIRST RUN
Internet access may be required by the existing audio setup to obtain its separately distributed conversion dependencies. The NFS Heat encryption key is extracted from the user's installed copy of the game and is never included in this package.

The builder creates a verified portable baseline from the player's own original game files on the first build and reuses it later. Libraries with one song now use the same full builder as multi-song libraries. All 71 playlist resources (including garage/loading variants), 126 race-intro segments and both menu resources are required. A partial 19-resource build is rejected before export or assembly. Compatible conversions are reused; different race-intro cuts remain separate.

LICENSES AND SOURCE
Application source and Frosty integration changes are published with the repository. Frosty GPL notices and the pinned-source patch are included in licenses and source. No UNITE files, user music, game files, encryption keys, caches or generated profiles are distributed here.

TEST STATUS
Address, coverage and relocated-table regressions exercise production code. See the Beta7.1 report for completed assembly audits and remaining gameplay checks. Historic hash counts alone must not be interpreted as gameplay approval.

LOCAL AUDIO TEST
Use MODS & LAUNCH with the prepared soundtrack and other mods unchecked first.
When a replaced track plays, wait through its end (about 4min34s for the Skrillex
test) and check automatic and manual track changes. Report context and elapsed
time if silence returns. Test UNITE separately after the audio-only result.
