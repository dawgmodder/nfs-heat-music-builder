NFS Heat — Music Builder V4.1 (experimental portable version)

V4.1 interface refinement
Reorganized setup and action layout, improved disabled-state contrast, Segoe UI
typography, library empty state and selected-track waveform heading.
This is an independent community tool, not an official EA product.

V4 desktop experience
New multi-resolution application icon, branded header, live activity strip and
desktop notifications for analysis, installation, errors and preset transfers.
Click a notification to return to the application. Uncheck Desktop notifications
to mute them for this session. Windows notification settings / Do Not Disturb
may suppress desktop alerts; the activity strip and log remain available.
Normalization and encoding are interleaved, so completion is reported for the
whole operation, not prematurely after an individual audio file.
Closing still follows the existing safe cancellation workflow; the tray icon
does not keep the application running after it closes. Audio behavior is V3.27.

V3.27 race and garage timing
Mark the actual musical drop. Rendering starts the race segment 1 second earlier
to compensate for the reported delay between the audio event and visual start.
Existing presets are not shifted: if you manually marked 1 second before the
real drop, move that marker 1 second forward. Changed intro cuts need conversion.
Garage segments disable RestartIfAlreadyPlaying; playlist selection is unchanged.
This may preserve playback when loading retriggers the same active segment, but
cannot preserve an audio instance destroyed by the game. Both changes require
in-game verification. Menu playback is unchanged.

V3.26.1 converter ending fix
Some MP3 endings make the converter hang at all tested bitrates. Failed
segments are retried from PCM with 12, 24 or 48 ms of end padding. Music is
not shortened, and the original 100 ms output-duration tolerance and complete
EA structure checks remain mandatory. Valid V3.26 cache entries are reused.

V3.26 audio timing fix
Conversion uses a deterministic noise floor near -90 dBFS and disables the MP3
bit reservoir to prevent dandev-el3 from dropping digital-silence frames. Requested
segments are retried without progressively cutting music. EA header wrap repair
and structural/duration validation are shared by all three builders.
The game music inventory is checked before conversion. A report is saved as
output/game-audit-v326.json. This checks file compatibility, not in-game behavior.
There is no arbitrary track-duration selection cap, including the menu.
The EA sample field is 30 bits and CAS offsets are 32 bits; these format limits
are enforced. They are not a guarantee of unlimited playback support.
Minimum durations, file-size limits, timeouts and audio-integrity checks remain.
Long tracks may still fail due to converter, resource or game-format limitations;
removing the selection limit does not guarantee unlimited playback support.
Tracks longer than the old limit have not been validated in gameplay.

English interface
All application tabs, controls, help text, owned diagnostics and this guide are
in English. Native Windows dialogs and third-party tools may use your OS language.
Your music filenames and existing preset names are not renamed or translated.

Getting started
1. Extract the entire ZIP into a writable folder outside Program Files.
2. Open HeatMusicInstallerV4.exe. Windows 10/11 x64 and a legitimate NFS Heat
   installation through Steam or the EA App are required. First-time setup needs
   an internet connection. Administrator privileges are required for installation.
3. Select the game folder containing NeedForSpeedHeat.exe and one folder with
   your music. Click ANALYZE AND CONFIGURE, review playlists and drops in the
   CONFIGURE MUSIC tab, then click NORMALIZE AND INSTALL on the INSTALL tab.
4. Alternatively, open CONFIGURE MUSIC and click IMPORT PRESET. You do not need
   to analyze a folder before importing. Select a .heatpreset file, review the
   settings, then return to INSTALL and click NORMALIZE AND INSTALL.
5. Close the game before installing. Keep several GB of free disk space.
6. On Steam, use LAUNCH GAME WITH MOD. For the EA App, use COPY EA APP LAUNCH
   OPTION and paste the copied argument into NFS Heat > Manage > View properties
   > Advanced launch options. Then launch the game through the EA App.

Music configuration
- Select a track in multiple playlists to reuse it in different contexts.
- Playlist headers show used and free slots. Maximum capacities: garage 12,
  free roam day 10, free roam night 16, race day 10 and race night 11.
- Select a row to preview the track. Left-click/drag the waveform to move the
  pink drop marker; right-click during playback to seek. Yellow shows playback.
- SAVE SETTINGS preserves playlist assignments, the menu track and drop times.
- Race intros reuse race tracks. The automatic drop is only an estimate; review it.
  Minimum drop depends on the assigned race-intro sequence. Validation reports
  that sequence's actual minimum before conversion, including the 1 s compensation.
- In the lobby, the introduction plays once. The loop starts after its actual
  encoded end (approximately 11 seconds). Only the remainder repeats, without
  a crossfade. The menu track must be longer than 12 seconds.

Sharing presets with converted audio
- Build once using V3.26, then click EXPORT PRESET in CONFIGURE MUSIC.
  The .heatpreset includes source music, settings, available normalized WAVs,
  converted EA Layer3 segments and measurements. The log reports segment count.
- On another computer, import the entire preset file. Compatible audio is reused
  without repeating normalization or conversion. Game metadata and ModData still
  need to be built and applied locally.
- New music, drop times, cuts or converter versions may require new conversions.
  A preset exported before building may have only partial or no converted audio;
  the application warns you and processes missing results when installing.
- Older presets are supported, but those without an audio cache need conversion.
  Existing normalized WAVs are reused. Older EA segments are converted once
  under the V3.26 timing policy; source files and existing caches are preserved.
  Presets exported after a V3.26 build reuse these new EA conversions.
- SHA-256 content hashes, segment parameters and tool hashes identify compatible
  results, independently of original PC paths. Damaged cache is not reused.
- Presets can be large because they include normalized WAVs for future cuts.
  Limits: 20 GB total including cache, 1 GB per file. Share only music you have
  permission to distribute. Presets contain no game files or encryption keys.

Installation and safety
The installer creates a separate ModData folder and does not overwrite the game's
original Data/Patch files. Installation does not automatically launch the game.
Closing while processing requests safe cancellation; an active ModData write is
allowed to finish before the window closes. Preset transfers finish before closing.

First-time setup downloads Frosty Editor v1.0.6.3, Frosty Sound Import v1.3.3.3
and FFmpeg Essentials from their publishers and verifies SHA-256 hashes. Frosty
is patched only in a local copy to avoid automatic game launch and its blocking
first-install information dialog. UAC and link validation are not disabled.

This package contains no music, game files, encryption key, modified Frosty,
FFmpeg or EA converter binary. The key is extracted only from the user's own
game executable after checking its expected signature and hash. Some game
revisions, including EA App revisions, may be rejected if their layout is unknown.
Do not disable these compatibility checks. The development game build is Steam.

Publishers and licenses
Frosty Toolsuite: https://github.com/CadeEvs/FrostyToolsuite
Frosty Sound Import: https://github.com/DanielElam/bf2-sound-import
FFmpeg Essentials (Gyan): https://www.gyan.dev/ffmpeg/builds/
Node.js v24.13.1: https://nodejs.org/dist/v24.13.1/
The bundled Node.js executable is covered by NODE-LICENSE.txt. Other third-party
executables are downloaded during setup, not included in this ZIP.
