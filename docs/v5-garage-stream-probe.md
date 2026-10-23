# Garage stream-resolution diagnostic (not a release)

The user reproduced the white/pink garage using only UNITE 3.5 in official
Frosty 1.0.6.3, in a freshly generated `DiagnosticoUNITE` pack. Thus the music
mod is not required to reproduce the visual issue. This does not prove its root
cause or rule out shared local state.

Independent exact-range TOC/SB/CAS checks found all 34 occurrences of the two
garage HDRI RES/chunk pairs match UNITE's payloads in both official output and
Beta 7.2. However, their original Data/chunks1 global entries still resolve to
different, original pixel streams:

| GUID | Original expanded bytes | UNITE expected expanded bytes |
| --- | ---: | ---: |
| 893fe439-0a8a-2b1c-d292-6658ca610755 | 32,768 | 8,192 |
| 77f608ad-4261-d1b0-da7d-465491e702cd | 11,184,848 | 4,194,304 |

UNITE RES headers specify format 67 and the smaller sizes. CAS framing totals
agree with the new headers for UNITE's own streams. No assumption about actual
engine lookup priority is warranted yet. Coexisting entries alone do not prove
which stream the game uses, or why it renders incorrectly.

`work/HeatGarageStreamProbe.js` is a diagnostic helper, not integrated into the
installer. It accepts an independently generated bundle audit and a new sibling
ModData path. It changes only the two 12-byte global location records to point
at verified UNITE payloads already in the profile. It preserves GUID/hash tables,
bundles, audio and pixel bytes. Everything else is read-only hardlink/junction
sharing; the changed TOC is a private copy. Do not regenerate either profile with
Frosty while conducting this comparison. No old profile is overwritten.

The source profile for the local experiment is Beta 7.2 with UNITE + soundtrack;
its separate target is `HeatGarageStreamProbe`. This is not an official-manager
compatibility fix and must not be distributed with copyrighted game/music data.

Automated checks: dry run, invalid audit rejection, changed-payload rejection,
conflicting payload rejection, isolated creation preserving source bytes, and
existing-destination rejection. Run `node work/test-garage-stream-probe.js`.

The local profile was created and checked: original/source TOCs unchanged,
one private changed file, 150 shared files, two unchanged directory junctions,
199/199 soundtrack resources matched, and 34/34 target texture occurrences
still matched in bundles. The broader bundle audit remains 35,444/35,445;
the previously documented Aventador alias discrepancy is unchanged and not
presented as passing. No game launch was performed by the diagnostic tool.

Gameplay confirmation is pending. If the new profile fixes rendering, investigate
global stream resolution before designing a general solution. If it does not,
do not broaden this patch blindly to other chunks or alter lighting values.
