NFS Heat Music Builder 4.3 — Official Frosty companion

This is a community tool, not an EA product. The original Frosty DLLs remain intact.

1. Build/export your music. Keep the FBMOD and the entire matching .music folder.
2. Import the FBMOD into official Frosty Mod Manager 1.0.6.3. Apply your other mods,
   then the matching soundtrack LAST. Do not apply multiple soundtrack exports.
3. Click Launch in Frosty to generate its ModData profile. If the game opens,
   close it without playing. Music is NOT ready at this stage: the FBMOD alone
   cannot apply all of Heat's global audio chunks with this manager version.
4. In Music Builder select FINISH FROSTY. Select the soundtrack.heatmusic FILE
   in the .music folder, and the generated PROFILE FOLDER inside game/ModData
   (for example custom, NOT the ModData folder itself).
5. Click FINALIZE AND VERIFY. This creates a new HeatMusicCombined_... profile,
   preserves the source profile, copies other mod resources, and verifies all
   199 resolved music payloads. No music is converted again at this stage.
6. Use START COMBINED GAME. Remove conflicting -dataPath options from Steam/EA.
   Do not use Frosty's Launch button for normal play after finalizing: it starts
   Frosty's unfinalized profile, not the separate combined profile.

After changing the Frosty mod selection/order, generate it in Frosty again,
close the game, and finalize again. The previous combined profile is remembered
and revalidated before launch when you reopen the builder. Existing profiles
are retained.

Safety: the game must be closed. The original Data/Patch and source Frosty
profile are never patched in place. Failure/cancellation may leave a .partial
folder in ModData; it is NOT marked playable and is never launched. No process
is killed on close. Wait for safe cancellation to complete. Creating a combined
profile needs free disk space for audio and Frosty-generated resources.

UNITE: this workflow preserves other mod files. In-game compatibility is not
claimed until tested. Mods changing the same music graphs can still conflict;
place the soundtrack last. The standalone soundtrack was verified on disk,
not tested in gameplay in this release's automated tests.

Distribution package does not contain music, game data, game keys, caches or
Frosty binaries. Build dependencies are configured by the existing bootstrap.
Keep converted soundtrack companions private unless you have distribution
rights to the included music.
