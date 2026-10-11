using System;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading;
using Frosty.Core;
using Frosty.ModSupport;
using FrostySdk;
using FrostySdk.Interfaces;
using FrostySdk.Managers;

internal sealed class SizeApplyLogger : ILogger
{
    public void Log(string message, params object[] values)
    {
        if (String.Equals(message, "Launching Game", StringComparison.Ordinal)) return;
        Console.WriteLine(string.Format(message, values));
    }
    public void LogWarning(string message, params object[] values) { Console.WriteLine("WARNING " + string.Format(message, values)); }
    public void LogError(string message, params object[] values) { Console.Error.WriteLine("ERROR " + string.Format(message, values)); }
}

internal static class ApplyHeatTrack24Size
{
    private static readonly string Runtime = Environment.GetEnvironmentVariable("HEAT_MUSIC_FROSTY_RUNTIME") ?? @"C:\Users\WIN10\AppData\Local\HeatMusicReplacer\Runtime";
    private static readonly string NoLaunchSupport = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "NoLaunchRuntimeV3", "FrostyModSupport.dll");
    private const string NoLaunchSha = "ae59685bb44793b1ea7cecb979e2262d49f17aec2f4c43f3df1ea090deacb04b";
    private static readonly string Game = Environment.GetEnvironmentVariable("HEAT_MUSIC_GAME") ?? @"C:\Program Files (x86)\Steam\steamapps\common\Need for Speed Heat";
    private static readonly string ModDirectory = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "output"));
    private static Assembly ResolveAssembly(object sender, ResolveEventArgs args)
    {
        string shortName = new AssemblyName(args.Name).Name;
        if (shortName == "EbxClasses") return Assembly.LoadFrom(Path.Combine(Runtime, "Profiles", "NFSHEATSDK.dll"));
        if (shortName == "FrostyModSupport") return Assembly.LoadFrom(NoLaunchSupport);
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
        if (!File.Exists(NoLaunchSupport)) throw new FileNotFoundException("No-launch Frosty support missing", NoLaunchSupport);
        using (SHA256 sha = SHA256.Create())
        using (FileStream stream = File.OpenRead(NoLaunchSupport))
            if (!String.Equals(BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant(),
                NoLaunchSha, StringComparison.Ordinal))
                throw new InvalidDataException("No-launch Frosty support checksum mismatch");
        if (!String.Equals(Path.GetFullPath(typeof(FrostyModExecutor).Assembly.Location),
            Path.GetFullPath(NoLaunchSupport), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Wrong FrostyModSupport assembly loaded");
        // Fail before touching ModData if the local no-launch IL cannot be JIT-compiled.
        System.Runtime.CompilerServices.RuntimeHelpers.PrepareMethod(
            typeof(FrostyModExecutor).GetMethod("Run").MethodHandle);
        bool preflight = args.Length == 1 && (args[0] == "preflight" || args[0] == "ready");
        if (preflight)
        {
            if(args[0]=="ready"&&!new System.Security.Principal.WindowsPrincipal(
                System.Security.Principal.WindowsIdentity.GetCurrent()).IsInRole(
                System.Security.Principal.WindowsBuiltInRole.Administrator))
                throw new InvalidOperationException("Execute o instalador como administrador para criar os links do ModData.");
            if (args[0] == "ready" &&
                System.Diagnostics.Process.GetProcessesByName("NeedForSpeedHeat").Length != 0)
                throw new InvalidOperationException("Close NFS Heat before installing the new mod");
            Console.WriteLine("NO_LAUNCH_FROSTY_READY");
            return 0;
        }
        bool menu = args.Length == 1 && args[0] == "menu";
        bool menuLoop = args.Length == 1 && args[0] == "menuloop";
        bool menuLead = args.Length == 1 && args[0] == "menulead";
        bool raceIntro = args.Length == 1 && args[0] == "raceintro";
        bool forceIntro = args.Length == 1 && args[0] == "forceintro";
        bool firstBatch = args.Length == 1 && args[0] == "firstbatch";
        bool dynamicBuild = args.Length == 4 && args[0] == "dynamic";
        if (args.Length != 0 && !menu && !menuLoop && !menuLead && !raceIntro && !forceIntro && !firstBatch && !dynamicBuild) throw new ArgumentException("Unexpected variant");
        string modName = dynamicBuild ? args[2] : firstBatch ? "Heat-Track1-Track2-Track24-FirstBatch.fbmod"
            : forceIntro ? "Heat-Track24-ForcedRaceIntro.fbmod"
            : raceIntro ? "Heat-Track24-FiveResources-Menu-RaceIntro.fbmod"
            : menuLead ? "Heat-Track24-FiveResources-MenuLeadLoop.fbmod"
            : menuLoop ? "Heat-Track24-FiveResources-MenuLoopChunk.fbmod"
            : menu ? "Heat-Track24-FiveResources-MenuNoChunk.fbmod" : "Heat-Track24-FiveResources.fbmod";
        string modDataName = dynamicBuild ? args[3] : firstBatch ? "HeatTrackFirstBatchResourcesOnly"
            : forceIntro ? "HeatTrack24ForcedIntroResourcesOnly"
            : raceIntro ? "HeatTrack24RaceIntroResourcesOnly"
            : menuLead ? "HeatTrack24MenuLeadResourcesOnly"
            : menuLoop ? "HeatTrack24MenuLoopResourcesOnly"
            : menu ? "HeatTrack24MenuResourcesOnly" : "HeatTrack24FiveResourcesOnly";
        string modDirectory = dynamicBuild ? Path.GetFullPath(args[1]) : ModDirectory;
        if (dynamicBuild && (modName != Path.GetFileName(modName) ||
            !System.Text.RegularExpressions.Regex.IsMatch(modDataName, @"^[A-Za-z0-9_-]{1,64}$")))
            throw new ArgumentException("Unsafe dynamic mod name or target");
        string target = Path.Combine(Game, "ModData", modDataName);
        if (Directory.Exists(target)) throw new InvalidOperationException("Target already exists: " + target);
        if (!File.Exists(Path.Combine(modDirectory, modName))) throw new FileNotFoundException("Metadata mod missing");
        if (System.Diagnostics.Process.GetProcessesByName("NeedForSpeedHeat").Length != 0)
            throw new InvalidOperationException("Close the game before applying mods");
        Environment.CurrentDirectory = Runtime;
        ILogger logger = new SizeApplyLogger();
        App.Logger = logger;
        App.PluginManager = new PluginManager(logger, PluginManagerType.Editor);
        Config.Load("");
        ProfilesLibrary.Initialize(App.PluginManager.Profiles);
        if (!ProfilesLibrary.Initialize("NeedForSpeedHeat")) throw new InvalidOperationException("Heat profile missing");
        TypeLibrary.Initialize();
        FileSystem fs = new FileSystem(Game);
        if (ProfilesLibrary.Sources != null)
            foreach (FileSystemSource source in ProfilesLibrary.Sources) fs.AddSource(source.Path, source.SubDirs);
        fs.Initialize(File.ReadAllBytes(Path.Combine(Runtime, "NFSHEAT.key")));
        App.FileSystem = fs;
        App.ResourceManager = new ResourceManager(fs);
        App.ResourceManager.SetLogger(logger);
        App.ResourceManager.Initialize();
        App.AssetManager = new AssetManager(fs, App.ResourceManager);
        App.PluginManager.Initialize();
        Console.WriteLine("Applying " + (dynamicBuild ? "configured music contexts"
            : firstBatch ? "Track 1 day, Track 2 night, and Track 24 elsewhere"
            : forceIntro ? "forced day-night intros, menu, and five slots"
            : raceIntro ? "menu, five slots, and day-night race intros"
            : menuLead ? "menu lead and loop plus five slots"
            : menuLoop ? "menu loop plus five slots" : menu ? "menu plus five slots" : "five slots") + " mod to " + target);
        Console.WriteLine("FROSTY_UNATTENDED_READY: aviso informativo inicial desativado; validacao dos links mantida.");
        FrostyModExecutor executor = new FrostyModExecutor();
        int status = executor.Run(fs, CancellationToken.None, logger, modDirectory, modDataName, "", modName);
        Console.WriteLine("Frosty status=" + status);
        if (System.Diagnostics.Process.GetProcessesByName("NeedForSpeedHeat").Length != 0)
            throw new InvalidOperationException("Frosty unexpectedly launched the game during installation");
        return status == 0 ? 0 : 1;
    }
}
