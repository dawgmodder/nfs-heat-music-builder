NFS HEAT MUSIC BUILDER V5 BETA 6 — ADDRESS REGRESSION TEST

This is a diagnostic build, not a stable release. It fixes catalog addresses and
validates audio using the final TOC and layout. See docs/v5-beta6-address-test.md.
The white/pink garage issue is not fixed. In-game confirmation is still required.

This test build uses its own manager based on the current GPLv3 Frosty source. It is not a claim of compatibility with the official Frosty Mod Manager 1.0.6.3.

WORKFLOW
1. Select the NFS Heat folder and build or import your soundtrack.
2. Open Mods & Launch.
3. Import the original UNITE .fbpack directly, or add individual .fbmod files.
4. Check the components you want and adjust their order. Handling and stance alternatives are mutually exclusive.
5. The custom soundtrack is always applied last.
6. Click APPLY MODS AND LAUNCH.

Importing only records the package and selection. Launch prepares a temporary profile, validates it, preserves the previous working profile on failure or cancellation, then starts NFS Heat with ModData/HeatMusicV5Beta6AddressTest. The existing ModData/HeatMusicV5 profile is not replaced.

Steam installations are launched through Steam AppID 1222680 so the dataPath reaches the game. The package includes Frosty's GPL-distributed CryptBase launch shim and copies it beside the game executable only when it is absent; an existing file is never overwritten. EA App-only installations receive both -dataPath and GAME_DATA_DIR, but still require separate gameplay confirmation.

FIRST RUN
Internet access may be required by the existing audio setup to obtain its separately distributed conversion dependencies. The NFS Heat encryption key is extracted from the user's installed copy of the game and is never included in this package.

The builder creates a verified portable baseline from the player's own original game files on the first build and reuses it later. This controlled test retains Beta 5's limited 19-resource single-song layout: five original playlist tracks, menu lead/loop and two race-intro sequences. Other original tracks may still play. Full single-song playlist coverage is pending; the previous claim that this layout reproduced working V4.1 was incorrect. Multi-song libraries retain the complete layout, which still needs real-profile validation with this patch.

LICENSES AND SOURCE
Application source and Frosty integration changes are published with the repository. Frosty GPL notices and the pinned-source patch are included in licenses and source. No UNITE files, user music, game files, encryption keys, caches or generated profiles are distributed here.

TEST STATUS
Address regressions exercise the production writer and validator: Data catalogs 0/1, Patch resolution, wrong/unknown catalogs, bounds, truncation, hashes, GUIDs and preservation of source files. A detached test using the user's existing 19-resource build passed production validation and an independent binary audit (19/19 final addresses). No game was launched for these tests. Historic 199/199 checks did not validate catalog resolution and must not be interpreted as gameplay approval.

LOCAL AUDIO TEST
Use MODS & LAUNCH with the prepared soundtrack and other mods unchecked first.
When a replaced track plays, wait through its end (about 4min34s for the Skrillex
test) and check automatic and manual track changes. Report context and elapsed
time if silence returns. Test UNITE separately after the audio-only result.
