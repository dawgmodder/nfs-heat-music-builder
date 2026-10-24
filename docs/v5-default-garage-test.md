# UNITE default-garage isolation test

This is a local diagnostic, not a release or a confirmed fix of UNITE's custom
nighttime garage. The user approved testing the authors' vanilla-garage addon
after reproducing white/pink rendering with UNITE alone in official Frosty and
with UNITE + soundtrack in the GPL integration. Graphics Low/HDR Off did not
resolve it; the user reports the streets render normally.

## Correct source

The addon belongs to **UNITE Heat Optional Mods - Extras**, Nexus file 1144,
not Optional Visuals (file 1145). The Visuals archive was inspected and contains
no garage addon. No other optional mods should be enabled for this experiment.

https://www.nexusmods.com/needforspeedheat/mods/37?tab=files&file_id=1144

The user's downloaded Extras archive contains `Revert To Default Garage.fbmod`
(10,089,979 bytes), whose SHA-256 is
`115912509cb68fa0c330b00d249c356b7fe421ad798b5e559c1a8ce1d9c9bbe5`.
Its embedded metadata identifies UNITE Team, version 1.0, and instructs placing
it below UNITE. It supplies 17 resources: 13 EBX, two texture RES and two chunks.
It has no audio resources or resource handlers.

## Isolation and storage

Desired override priority: UNITE Heat 3.5, Revert To Default Garage, existing custom soundtrack
(the last entry should win).
This mirrors the last diagnostic selection; no handling/stance components are
newly enabled. Existing converted music is reused; no audio re-encoding.

Only approximately 1.5 GB was available on C:, so assembly was redirected to a
new `D:\NFS Heat Mods\HeatDefaultGarageTest_Work` folder with user-approved
filesystem access. A private runtime and a game-input mirror are used there.
The original Data/Patch inputs are read through directory junctions; the new
profile is assembled separately. Seven original files and the same seven paths
in the previous music profile are hashed before/after assembly.

The intended in-game path is `ModData/HeatDefaultGarageTest`, a new junction to
the validated D: profile. Neither existing profiles nor Steam launch settings
are overwritten. The test launcher must refuse to launch while Heat is running.
Do not distribute these local files: they include game-derived data and music.

## Validation status

The first assembly completed and validated all 199 audio resources, but the
independent bounded TOC/SB/CAS audit rejected the garage addon: 14 of its 17
resources still contained UNITE's bytes. Every unexpected addon payload matched
UNITE exactly, not unknown/corrupt bytes. This failing profile was not linked
into the game or offered for gameplay testing.

The GPL executor's `ProcessModResources` keeps the **first** encountered payload
for ordinary EBX, RES and chunk conflicts. `GenerateModInfoList` and the CLI keep
the supplied list order. Passing the conventional last-wins list directly thus
reverses intended override priority. This is a confirmed addon-application
problem, not proof of the cause of the original white/pink garage (which also
occurs with UNITE alone in official Frosty).

A second isolated assembly uses CLI order **soundtrack, default-garage addon,
UNITE**, with the same runtime and cached converted mods. This diagnostic does
not change the released installer or the user's saved mod list. Its independent
audit must verify all 17 addon resources and music before exposing the profile.
No game test has been performed. Do not call this a successful rendering fix
until the user confirms the garage and music in the running game.

## Completed local validation

The corrected-order build completed with exit code 0. Independent bounded
TOC/SB/CAS payload checks verified all 17 addon resources in 134 occurrences,
including the two HDRI pixel streams. The converted addon payloads are identical
to its original FBMOD payloads. The garage playlist metadata now matches the
soundtrack instead of UNITE, and all 199 installed music streams match their
expected bytes. All 14 monitored original/prior-profile files retain their
before-build hashes. This is not a full Steam integrity check.

The wider bundle SHA audit matches 35,924/35,925 entries with zero parse errors.
The sole remaining mismatch is the previously recorded Aventador alias in
`vehicles1.toc`, not a garage/audio resource; it is not counted as passing.

The final profile is `game/ModData/HeatDefaultGaragePriorityTest` inside the D:
test folder. `ModData/HeatDefaultGarageTest` in the real game links to it.
Use `D:\NFS Heat Mods\HeatDefaultGarageTest_Work\LaunchDefaultGarageTest.cmd`.
The rejected first assembly remains separate for diagnostic comparison. No
installed profile, saved selection, released installer or original game asset
was overwritten; no game was launched. Gameplay confirmation remains pending.
