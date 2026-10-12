using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Threading;
using Frosty.Core;
using Frosty.Core.Mod;
using Frosty.Core.IO;
using FrostySdk;
using FrostySdk.Interfaces;
using FrostySdk.IO;
using FrostySdk.Managers;

internal sealed class SizeModLogger : ILogger
{
    public void Log(string text, params object[] values) { Console.Error.WriteLine(string.Format(text, values)); }
    public void LogWarning(string text, params object[] values) { Console.Error.WriteLine("WARNING: " + string.Format(text, values)); }
    public void LogError(string text, params object[] values) { Console.Error.WriteLine("ERROR: " + string.Format(text, values)); }
}

internal static class HeatTrack24SizeMod
{
    private static readonly string Runtime = Environment.GetEnvironmentVariable("HEAT_MUSIC_FROSTY_RUNTIME") ?? @"C:\Users\WIN10\AppData\Local\HeatMusicReplacer\Runtime";
    private static readonly string Game = Environment.GetEnvironmentVariable("HEAT_MUSIC_GAME") ?? @"C:\Program Files (x86)\Steam\steamapps\common\Need for Speed Heat";
    private static readonly string OutputFolder = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "output"));
    private static readonly string IntroWaveSpecFile = Path.Combine(OutputFolder, "race-intro-track24-test", "waves.tsv");
    private const uint AudioBytes = 2127236;
    private const float AudioSeconds = 102.696f;
    private static readonly string[] Waves = {
        "Audio/Music/Roboto/Playlist/DC_FelixJaehnBreakingBeattz_LIITA",
        "Audio/Music/Roboto/Playlist/NC_Logic_Mama_ShowLoveftYBNCordae",
        "Audio/Music/Roboto/Playlist/DI_TheTribeOfGood_TurningUpForTheSunshine(Remix)",
        "Audio/Music/Roboto/Playlist/NI_MNKYBSNSS_OtroLugar",
        "Audio/Music/Roboto/Playlist/GA_KingsOfTheRollers_GuitarTrack"
    };
    private static readonly float[] OriginalSeconds = { 250.2389f, 241.3173f, 274.5528f, 302.106f, 315.0974f };

    private static Assembly ResolveAssembly(object sender, ResolveEventArgs args)
    {
        string shortName = new AssemblyName(args.Name).Name;
        if (shortName == "EbxClasses") return Assembly.LoadFrom(Path.Combine(Runtime, "Profiles", "NFSHEATSDK.dll"));
        foreach (string folder in new[] { Runtime, Path.Combine(Runtime, "ThirdParty"), Path.Combine(Runtime, "Profiles"), Path.Combine(Runtime, "Plugins") })
        {
            string file = Path.Combine(folder, shortName + ".dll");
            if (File.Exists(file)) return Assembly.LoadFrom(file);
        }
        return null;
    }

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            AppDomain.CurrentDomain.AssemblyResolve += ResolveAssembly;
            if (System.Windows.Application.Current == null) new System.Windows.Application();
            return Run(args);
        }
        catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
    }

    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    private static int Run(string[] args)
    {
        bool menuTest = args.Length == 1 && args[0] == "menu";
        bool menuLoop = args.Length == 1 && args[0] == "menuloop";
        bool menuLead = args.Length == 1 && args[0] == "menulead";
        bool raceIntro = args.Length == 1 && args[0] == "raceintro";
        bool forceIntro = args.Length == 1 && args[0] == "forceintro";
        bool firstBatch = args.Length == 1 && args[0] == "firstbatch";
        bool dynamicAllIntro = args.Length == 3 && args[0] == "dynamicallintro";
        bool dynamicBuild = args.Length == 3 && (args[0] == "dynamic" || dynamicAllIntro);
        bool includeIntro = raceIntro || forceIntro || firstBatch || dynamicBuild;
        if (args.Length != 0 && !menuTest && !menuLoop && !menuLead && !includeIntro) throw new ArgumentException("Unexpected variant");
        string output = dynamicBuild ? Path.GetFullPath(args[2]) : Path.Combine(OutputFolder, firstBatch ? "Heat-Track1-Track2-Track24-FirstBatch.fbmod"
            : forceIntro ? "Heat-Track24-ForcedRaceIntro.fbmod"
            : raceIntro ? "Heat-Track24-FiveResources-Menu-RaceIntro.fbmod"
            : menuLead ? "Heat-Track24-FiveResources-MenuLeadLoop.fbmod"
            : menuLoop ? "Heat-Track24-FiveResources-MenuLoopChunk.fbmod"
            : menuTest ? "Heat-Track24-FiveResources-MenuNoChunk.fbmod" : "Heat-Track24-FiveResources.fbmod");
        string[] waveNames = menuLead || includeIntro ? new[] { Waves[0], Waves[1], Waves[2], Waves[3], Waves[4],
            "Audio/Music/Roboto/LoadingScreen_Music/Roboto_Bootflow_Loop_Underground",
            "Audio/Music/Roboto/LoadingScreen_Music/Roboto_Bootflow_LeadIn_Underground" }
            : menuLoop ? new[] { Waves[0], Waves[1], Waves[2], Waves[3], Waves[4],
                "Audio/Music/Roboto/LoadingScreen_Music/Roboto_Bootflow_Loop_Underground" } : Waves;
        float[] waveSeconds = menuLead || includeIntro ? new[] { OriginalSeconds[0], OriginalSeconds[1], OriginalSeconds[2],
            OriginalSeconds[3], OriginalSeconds[4], 62.60869f, 11.08696f }
            : menuLoop ? new[] { OriginalSeconds[0], OriginalSeconds[1], OriginalSeconds[2],
                OriginalSeconds[3], OriginalSeconds[4], 62.60869f } : OriginalSeconds;
        uint[] raceBytes = new uint[12];
        float[] raceSeconds = new float[12];
        uint[] batchBytes = { 6524810u, 6019134u };
        float[] batchSeconds = { 314.952f, 290.544f };
        if (includeIntro)
        {
            string[] lines = File.ReadAllLines(IntroWaveSpecFile);
            if (lines.Length != 12) throw new InvalidDataException("Expected twelve intro wave specifications");
            Array.Resize(ref waveNames, 19);
            Array.Resize(ref waveSeconds, 19);
            for (int i = 0; i < lines.Length; i++)
            {
                string[] fields = lines[i].Split('\t');
                if (fields.Length != 4 || !fields[0].StartsWith("Audio/Music/Roboto/RaceIntros/", StringComparison.Ordinal))
                    throw new InvalidDataException("Invalid intro wave specification: " + lines[i]);
                waveNames[i + 7] = fields[0];
                waveSeconds[i + 7] = float.Parse(fields[1], CultureInfo.InvariantCulture);
                raceBytes[i] = uint.Parse(fields[2], CultureInfo.InvariantCulture);
                raceSeconds[i] = float.Parse(fields[3], CultureInfo.InvariantCulture);
            }
        }
        uint[] dynamicBytes = new uint[19];
        float[] dynamicSeconds = new float[19];
        string[] dynamicAudioFiles = new string[19];
        if (dynamicBuild)
        {
            string waveSpecFile = Path.GetFullPath(args[1]);
            string[] lines = File.ReadAllLines(waveSpecFile);
            if (lines.Length < 19 || lines.Length > (dynamicAllIntro ? 256 : 100))
                throw new InvalidDataException("Unexpected dynamic wave specification count");
            int originalCount = waveNames.Length;
            Array.Resize(ref waveNames, lines.Length);
            Array.Resize(ref waveSeconds, lines.Length);
            Array.Resize(ref dynamicBytes, lines.Length);
            Array.Resize(ref dynamicSeconds, lines.Length);
            Array.Resize(ref dynamicAudioFiles, lines.Length);
            for (int i = 0; i < lines.Length; i++)
            {
                string[] fields = lines[i].Split('\t');
                if ((dynamicAllIntro ? fields.Length != 4 : (fields.Length != 3 && fields.Length != 4)) || (i < originalCount &&
                    !String.Equals(fields[0], waveNames[i], StringComparison.OrdinalIgnoreCase)) ||
                    (i >= originalCount && !fields[0].StartsWith("Audio/Music/Roboto/Playlist/", StringComparison.OrdinalIgnoreCase) &&
                     !(dynamicAllIntro && fields[0].StartsWith("Audio/Music/Roboto/RaceIntros/", StringComparison.OrdinalIgnoreCase))))
                    throw new InvalidDataException("Dynamic wave order/name mismatch at " + i);
                if (i >= originalCount) waveNames[i] = fields[0];
                dynamicBytes[i] = uint.Parse(fields[1], CultureInfo.InvariantCulture);
                dynamicSeconds[i] = float.Parse(fields[2], CultureInfo.InvariantCulture);
                if (dynamicBytes[i] < 24 || float.IsNaN(dynamicSeconds[i]) || float.IsInfinity(dynamicSeconds[i]) || dynamicSeconds[i] < 1 || (double)dynamicSeconds[i] * 48000 > 0x3fffffff)
                    throw new InvalidDataException("Dynamic wave size/duration out of range at " + i);
                if (dynamicAllIntro)
                {
                    string buildRoot = Path.GetFullPath(Path.GetDirectoryName(waveSpecFile)).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                    string audioFile = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(waveSpecFile), fields[3]));
                    if (!audioFile.StartsWith(buildRoot, StringComparison.OrdinalIgnoreCase) || !File.Exists(audioFile))
                        throw new InvalidDataException("Audio file is missing or outside the prepared build at " + i);
                    FileInfo audioInfo = new FileInfo(audioFile);
                    if (audioInfo.Length != dynamicBytes[i])
                        throw new InvalidDataException("Audio byte count does not match wave specification at " + i);
                    dynamicAudioFiles[i] = audioFile;
                }
            }
        }
        Environment.CurrentDirectory = Runtime;
        ILogger logger = new SizeModLogger();
        App.PluginManager = new PluginManager(logger, PluginManagerType.Editor);
        Config.Load("");
        ProfilesLibrary.Initialize(App.PluginManager.Profiles);
        if (!ProfilesLibrary.Initialize("NeedForSpeedHeat")) throw new InvalidOperationException("Heat profile missing");
        TypeLibrary.Initialize();
        App.FileSystem = new FileSystem(Game);
        if (ProfilesLibrary.Sources != null)
            foreach (FileSystemSource source in ProfilesLibrary.Sources) App.FileSystem.AddSource(source.Path, source.SubDirs);
        App.FileSystem.Initialize(File.ReadAllBytes(Path.Combine(Runtime, "NFSHEAT.key")));
        App.ResourceManager = new ResourceManager(App.FileSystem);
        App.ResourceManager.SetLogger(logger);
        App.ResourceManager.Initialize();
        App.AssetManager = new AssetManager(App.FileSystem, App.ResourceManager);
        App.PluginManager.Initialize();
        App.AssetManager.SetLogger(logger);
        App.AssetManager.Initialize(true, new AssetManagerImportResult());

        if (File.Exists(output)) throw new InvalidOperationException("Output already exists: " + output);
        HashSet<Guid> modifiedAudioChunks = new HashSet<Guid>();
        Dictionary<Guid, byte[]> audioChunkPayloads = new Dictionary<Guid, byte[]>();
        for (int waveIndex = 0; waveIndex < waveNames.Length; waveIndex++)
        {
            string name = waveNames[waveIndex];
            EbxAssetEntry entry = App.AssetManager.GetEbxEntry(name);
            if (entry == null || entry.Type != "NewWaveAsset") throw new InvalidDataException("Wave missing: " + name);
            EbxAsset asset = App.AssetManager.GetEbx(entry);
            object root = asset.RootObject;
            IList chunks = root.GetType().GetProperty("Chunks").GetValue(root, null) as IList;
            if (chunks == null || chunks.Count != 1) throw new InvalidDataException("Expected one chunk: " + name);
            object chunk = chunks[0];
            PropertyInfo size = chunk.GetType().GetProperty("ChunkSize");
            uint oldSize = (uint)size.GetValue(chunk, null);
            uint newSize = dynamicBuild ? dynamicBytes[waveIndex]
                : firstBatch && waveIndex < 2 ? batchBytes[waveIndex]
                : includeIntro && waveIndex >= 7 ? raceBytes[waveIndex - 7]
                : (menuLead || includeIntro) && waveIndex == 6 ? 227773u : AudioBytes;
            float newSeconds = dynamicBuild ? dynamicSeconds[waveIndex]
                : firstBatch && waveIndex < 2 ? batchSeconds[waveIndex]
                : includeIntro && waveIndex >= 7 ? raceSeconds[waveIndex - 7]
                : (menuLead || includeIntro) && waveIndex == 6 ? 10.992f : AudioSeconds;
            ResAssetEntry resource = App.AssetManager.GetResEntry(name);
            if (resource == null || resource.Type != "NewWaveResource")
                throw new InvalidDataException("NewWaveResource missing: " + name);
            byte[] dataBytes;
            using (Stream stream = App.AssetManager.GetRes(resource))
            {
                dataBytes = new byte[stream.Length];
                if (stream.Read(dataBytes, 0, dataBytes.Length) != dataBytes.Length)
                    throw new InvalidDataException("Short NewWaveResource read");
            }
            float originalSeconds = dynamicBuild && waveIndex >= 19
                ? BitConverter.ToSingle(dataBytes, 768) : waveSeconds[waveIndex];
            if (dataBytes.Length != 1088 || Math.Abs(BitConverter.ToSingle(dataBytes, 768) - originalSeconds) > 0.01f ||
                BitConverter.ToUInt32(dataBytes, 976) != oldSize)
                throw new InvalidDataException("Unexpected resource layout: " + name);
            int durationMatches = 0, sizeMatches = 0;
            for (int at = 0; at + 4 <= dataBytes.Length; at++)
            {
                if (Math.Abs(BitConverter.ToSingle(dataBytes, at) - originalSeconds) < 0.001f) durationMatches++;
                if (BitConverter.ToUInt32(dataBytes, at) == oldSize) sizeMatches++;
            }
            if (durationMatches != 1 || sizeMatches != 1)
                throw new InvalidDataException("Unexpected duplicate duration or size fields");
            byte[] chunkGuid = new byte[16];
            Array.Copy(dataBytes, 1072, chunkGuid, 0, 16);
            if (new Guid(chunkGuid) != (Guid)chunk.GetType().GetProperty("ChunkId").GetValue(chunk, null))
                throw new InvalidDataException("RES chunk GUID does not match EBX");
            size.SetValue(chunk, newSize, null);
            App.AssetManager.ModifyEbx(entry.Name, asset);
            Array.Copy(BitConverter.GetBytes(newSeconds), 0, dataBytes, 768, 4);
            Array.Copy(BitConverter.GetBytes(newSize), 0, dataBytes, 976, 4);
            App.AssetManager.ModifyRes(resource.ResRid, dataBytes, resource.ResMeta);
            entry.LinkAsset(resource);
            if (dynamicAllIntro)
            {
                Guid chunkId = (Guid)chunk.GetType().GetProperty("ChunkId").GetValue(chunk, null);
                byte[] audioBytes = File.ReadAllBytes(dynamicAudioFiles[waveIndex]);
                byte[] priorPayload;
                if (audioChunkPayloads.TryGetValue(chunkId, out priorPayload))
                {
                    if (priorPayload.Length != audioBytes.Length)
                        throw new InvalidDataException("Two wave assets assign different audio sizes to chunk " + chunkId);
                    for (int byteIndex = 0; byteIndex < audioBytes.Length; byteIndex++)
                        if (priorPayload[byteIndex] != audioBytes[byteIndex])
                            throw new InvalidDataException("Two wave assets assign different audio to chunk " + chunkId);
                }
                else
                {
                    ChunkAssetEntry audioEntry = App.AssetManager.GetChunkEntry(chunkId);
                    if (audioEntry == null) throw new InvalidDataException("Audio chunk is missing: " + chunkId);
                    if (!App.AssetManager.ModifyChunk(chunkId, audioBytes))
                        throw new InvalidDataException("Frosty rejected audio chunk: " + chunkId);
                    entry.LinkAsset(audioEntry);
                    audioChunkPayloads.Add(chunkId, audioBytes);
                    modifiedAudioChunks.Add(chunkId);
                    Console.WriteLine("AUDIO_CHUNK " + chunkId + " " + audioBytes.Length + " bytes " +
                        Path.GetFileName(dynamicAudioFiles[waveIndex]));
                }
            }
            Console.WriteLine("WAVE " + name + " duration " + originalSeconds + " -> " + newSeconds +
                ", bytes " + oldSize + " -> " + newSize);
        }

        if (menuTest)
        {
            EbxAssetEntry menuEntry = App.AssetManager.GetEbxEntry("Audio/Music/Roboto/Roboto_Music_LoadingScreen");
            EbxAssetEntry garageEntry = App.AssetManager.GetEbxEntry("Audio/Music/Roboto/Playlist/GA_KingsOfTheRollers_GuitarTrack");
            ResAssetEntry garageRes = App.AssetManager.GetResEntry(garageEntry.Name);
            if (menuEntry == null || garageEntry == null || garageRes == null) throw new InvalidDataException("Menu or garage asset missing");
            EbxAsset menuAsset = App.AssetManager.GetEbx(menuEntry);
            object bootflow = NamedChild(menuAsset.RootObject, "BootflowLoad");
            object lead = NamedChild(bootflow, "BootFlowLeadIn");
            object loop = NamedChild(bootflow, "BootFlowLoop");
            object targetWave = NamedChild(NamedChild(App.AssetManager.GetEbx("Audio/Music/Roboto/Roboto_LicensedMusic_Garage").RootObject,
                "Play_Garage"), "P_KingsOfTheRollers_GuitarTrack");
            IList targetParts = targetWave.GetType().GetProperty("Playables").GetValue(targetWave, null) as IList;
            object targetSegment = targetParts[0].GetType().GetProperty("Internal").GetValue(targetParts[0], null);
            object wavePointer = targetSegment.GetType().GetProperty("Wave").GetValue(targetSegment, null);
            if (wavePointer == null) throw new InvalidDataException("Garage Wave pointer missing");
            CheckAndRedirect(lead, new Guid("325fb2e3-5f60-11e9-b032-b6207b292ba4"), wavePointer);
            CheckAndRedirect(loop, new Guid("d554f2e7-6769-11e9-9faa-f1996278e951"), wavePointer);
            App.AssetManager.ModifyEbx(menuEntry.Name, menuAsset);
            garageEntry.AddToBundles(menuEntry.EnumerateBundles(false));
            garageRes.AddToBundles(menuEntry.EnumerateBundles(false));
            menuEntry.LinkAsset(garageEntry);
            menuEntry.LinkAsset(garageRes);
            Console.WriteLine("MENU BootFlowLeadIn and BootFlowLoop -> " + garageEntry.Name);
        }

        if (dynamicAllIntro)
        {
            PreserveGaragePlayback();
            ValidateRaceIntroCount("Audio/Music/Roboto/Roboto_LicensedMusic_RaceDay", 10);
            ValidateRaceIntroCount("Audio/Music/Roboto/Roboto_LicensedMusic_RaceNight", 11);
        }
        else if (forceIntro || firstBatch || dynamicBuild)
        {
            RestrictRaceIntro("Audio/Music/Roboto/Roboto_LicensedMusic_RaceDay",
                "DI_Intro_TOG_TurningUpForTheSunshine", 10);
            RestrictRaceIntro("Audio/Music/Roboto/Roboto_LicensedMusic_RaceNight",
                "NI_Intro_MNKYBSNSS_OtroLugar", 11);
        }

        ModSettings settings = new ModSettings();
        settings.Title = dynamicAllIntro ? "Heat custom soundtrack V2 (all race intros)"
            : dynamicBuild ? "Heat custom soundtrack (configurable contexts)"
            : firstBatch ? "Heat first batch: Track 1 day, Track 2 night, Track 24 elsewhere"
            : forceIntro ? "Heat Track 24 forced day-night race intros"
            : raceIntro ? "Heat Track 24 menu and day-night race intros"
            : menuLead ? "Heat Track 24 five contexts plus menu lead and loop chunks"
            : menuLoop ? "Heat Track 24 five contexts plus menu loop chunk test"
            : menuTest ? "Heat Track 24 five contexts plus menu test" : "Heat Track 24 five-context metadata correction";
        settings.Author = "Codex / local user";
        settings.Version = "0.1";
        settings.Description = dynamicAllIntro ? "Dynamic metadata for all licensed playlists and all twenty-one original race-intro sequences. The game's original race-intro selection remains intact. Audio is supplied by a separate ModData overlay."
            : dynamicBuild ? "Dynamic NewWaveAsset/NewWaveResource metadata for selected context chunks. Audio is supplied by the prepared audio overlay."
            : firstBatch ? "Isolated first batch: Track 1 in LIITA day free drive and Track 2 in Logic night free drive; Track 24 remains in menu, garage, generic race slots and forced day-night intros. Audio is supplied by a separate overlay."
            : forceIntro ? "Isolated test: menu, five contexts, and one Track 24 intro selected for every day or night race. The selected intro's six audio chunks are replaced."
            : raceIntro ? "Five original contexts, menu lead and loop, plus all six audio chunks for each of the selected day and night race intros. No music graph redirect."
            : menuLead ? "Five corrected songs plus direct replacements of the original menu lead and loop audio chunks. No music graph redirect."
            : menuLoop ? "Five corrected songs plus a direct replacement of the original menu loop audio chunk. No music graph redirect."
            : menuTest ? "Five corrected songs plus a menu Bootflow redirect to the garage song. Audio data is provided by a separate overlay."
            : "Updates five NewWaveAsset and NewWaveResource durations and chunk sizes to match the separate EA Layer3 data overlay. Does not change playlists or audio chunks.";
        FrostyProject project = new FrostyProject();
        project.WriteToMod(output, settings, false, CancellationToken.None);
        using (FileStream stream = File.OpenRead(output))
        using (FrostyModReader reader = new FrostyModReader(stream))
        {
            if (!reader.IsValid || reader.GameVersion != App.FileSystem.Head) throw new InvalidDataException("Exported mod failed validation");
            reader.ReadModDetails();
            BaseModResource[] resources = reader.ReadResources();
            int ebxCount = 0, resCount = 0, chunkCount = 0;
            foreach (BaseModResource resource in resources)
            {
                if (resource.Type == ModResourceType.Ebx)
                {
                    ebxCount++;
                    Console.WriteLine("EBX " + resource.Name);
                }
                else if (resource.Type == ModResourceType.Res)
                {
                    resCount++;
                    Console.WriteLine("RES " + resource.Name);
                }
                else if (resource.Type == ModResourceType.Chunk)
                {
                    chunkCount++;
                    Guid chunkId;
                    if (!Guid.TryParse(resource.Name, out chunkId) || !modifiedAudioChunks.Contains(chunkId))
                        throw new InvalidDataException("Unexpected audio chunk in exported mod: " + resource.Name);
                }
                else if (resource.Type != ModResourceType.Embedded)
                    throw new InvalidDataException("Unexpected mod resource: " + resource.Type);
            }
            if (ebxCount != waveNames.Length + (dynamicAllIntro ? 1 : 0) + (menuTest ? 1 : 0) + ((forceIntro || firstBatch || dynamicBuild) && !dynamicAllIntro ? 2 : 0) || resCount != waveNames.Length)
                throw new InvalidDataException("Unexpected EBX/RES count: " + ebxCount + "/" + resCount);
            if (dynamicAllIntro && chunkCount != modifiedAudioChunks.Count)
                throw new InvalidDataException("Exported chunk count does not match modified audio chunks: " + chunkCount + "/" + modifiedAudioChunks.Count);
            Console.WriteLine("OUTPUT " + output + " EBX=" + ebxCount + " RES=" + resCount + " CHUNK=" + chunkCount);
        }
        return 0;
    }

    private static void PreserveGaragePlayback()
    {
        const string name="Audio/Music/Roboto/Roboto_LicensedMusic_Garage";
        EbxAssetEntry entry=App.AssetManager.GetEbxEntry(name);
        if(entry==null||entry.Type!="MusicAsset")throw new InvalidDataException("Garage music graph missing");
        EbxAsset asset=App.AssetManager.GetEbx(entry);
        object playlist=NamedChild(asset.RootObject,"Play_Garage");
        IList phrases=playlist.GetType().GetProperty("Playables").GetValue(playlist,null) as IList;
        if(phrases==null||phrases.Count!=12)throw new InvalidDataException("Garage playlist layout changed");
        int changed=0;
        foreach(object pointer in phrases){
            object phrase=pointer.GetType().GetProperty("Internal").GetValue(pointer,null);
            IList segments=phrase.GetType().GetProperty("Playables").GetValue(phrase,null) as IList;
            if(segments==null||segments.Count!=1)throw new InvalidDataException("Garage segment layout changed");
            object segment=segments[0].GetType().GetProperty("Internal").GetValue(segments[0],null);
            PropertyInfo restart=segment.GetType().GetProperty("RestartIfAlreadyPlaying");
            if(restart==null||restart.PropertyType!=typeof(bool))throw new InvalidDataException("Garage restart flag missing");
            restart.SetValue(segment,false,null);
            if((bool)restart.GetValue(segment,null))throw new InvalidDataException("Garage restart flag was not changed");
            changed++;
        }
        App.AssetManager.ModifyEbx(entry.Name,asset);
        Console.WriteLine("GARAGE_RETRIGGER_PRESERVE "+changed+" segments; playlist selection unchanged");
    }

    private static object NamedChild(object parent, string name)
    {
        IList children = parent.GetType().GetProperty("Playables").GetValue(parent, null) as IList;
        if (children == null) throw new InvalidDataException("No playables under " + name);
        foreach (object pointer in children)
        {
            object child = pointer.GetType().GetProperty("Internal").GetValue(pointer, null);
            if (child != null && String.Equals(Convert.ToString(child.GetType().GetProperty("Name").GetValue(child, null)),
                name, StringComparison.OrdinalIgnoreCase)) return child;
        }
        throw new InvalidDataException("Missing playable: " + name);
    }

    private static void RestrictRaceIntro(string assetName, string selectedName, int expectedCount)
    {
        EbxAssetEntry entry = App.AssetManager.GetEbxEntry(assetName);
        if (entry == null || entry.Type != "MusicAsset") throw new InvalidDataException("Race music asset missing: " + assetName);
        EbxAsset asset = App.AssetManager.GetEbx(entry);
        object raceIntro = NamedChild(asset.RootObject, "PlayRaceIntro");
        IList playables = raceIntro.GetType().GetProperty("Playables").GetValue(raceIntro, null) as IList;
        if (playables == null || playables.Count != expectedCount)
            throw new InvalidDataException("Unexpected race intro count in " + assetName);
        object selected = null;
        foreach (object pointer in playables)
        {
            object child = pointer.GetType().GetProperty("Internal").GetValue(pointer, null);
            if (child != null && String.Equals(Convert.ToString(child.GetType().GetProperty("Name").GetValue(child, null)),
                selectedName, StringComparison.OrdinalIgnoreCase)) { selected = pointer; break; }
        }
        if (selected == null) throw new InvalidDataException("Race intro not found: " + selectedName);
        playables.Clear();
        playables.Add(selected);
        App.AssetManager.ModifyEbx(entry.Name, asset);
        Console.WriteLine("INTRO " + assetName + " " + expectedCount + " -> " + selectedName);
    }

    private static void ValidateRaceIntroCount(string assetName, int expectedCount)
    {
        EbxAssetEntry entry = App.AssetManager.GetEbxEntry(assetName);
        if (entry == null || entry.Type != "MusicAsset") throw new InvalidDataException("Race music asset missing: " + assetName);
        EbxAsset asset = App.AssetManager.GetEbx(entry);
        object raceIntro = NamedChild(asset.RootObject, "PlayRaceIntro");
        IList playables = raceIntro.GetType().GetProperty("Playables").GetValue(raceIntro, null) as IList;
        if (playables == null || playables.Count != expectedCount)
            throw new InvalidDataException("Unexpected race intro count in " + assetName);
        Console.WriteLine("INTRO " + assetName + " retains " + expectedCount + " choices");
    }

    private static void CheckAndRedirect(object segment, Guid expectedOldWave, object newWave)
    {
        PropertyInfo waveProperty = segment.GetType().GetProperty("Wave");
        object oldWave = waveProperty.GetValue(segment, null);
        object external = oldWave.GetType().GetProperty("External").GetValue(oldWave, null);
        if (!Convert.ToString(external).StartsWith(expectedOldWave.ToString(), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Unexpected original menu Wave pointer: " + external);
        waveProperty.SetValue(segment, newWave, null);
    }
}
