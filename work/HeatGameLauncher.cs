using System;
using System.Diagnostics;
using System.IO;
using Microsoft.Win32;

internal static class HeatGameLauncher
{
    private const string SteamAppId="1222680";

    public static Process Launch(string gameFolder,string relativeModData,string runtimeFolder,Action<string> log)
    {
        string exe=Path.Combine(gameFolder,"NeedForSpeedHeat.exe");
        if(!File.Exists(exe))throw new FileNotFoundException("NFS Heat executable was not found",exe);
        EnsureCryptBase(gameFolder,runtimeFolder,log);
        string steam=FindSteam();
        if(IsSteamInstall(gameFolder)&&!String.IsNullOrEmpty(steam)){
            string arguments=BuildSteamArguments(relativeModData);
            log("Launching through Steam: "+arguments);
            return Process.Start(new ProcessStartInfo{FileName=steam,Arguments=arguments,WorkingDirectory=Path.GetDirectoryName(steam),UseShellExecute=false});
        }
        string absolute=Path.GetFullPath(Path.Combine(gameFolder,relativeModData.Replace('/',Path.DirectorySeparatorChar)));
        log("Launching EA installation with -dataPath and GAME_DATA_DIR.");
        var info=new ProcessStartInfo{FileName=exe,Arguments="-dataPath \""+relativeModData+"\"",WorkingDirectory=gameFolder,UseShellExecute=false};
        info.EnvironmentVariables["GAME_DATA_DIR"]=absolute;
        return Process.Start(info);
    }

    internal static string BuildSteamArguments(string relativeModData)
    {
        if(String.IsNullOrWhiteSpace(relativeModData)||relativeModData.IndexOf('"')>=0)throw new ArgumentException("Invalid ModData path");
        return "-applaunch "+SteamAppId+" -dataPath \""+relativeModData.Replace('\\','/')+"\"";
    }

    private static bool IsSteamInstall(string gameFolder){return gameFolder.IndexOf(Path.Combine("steamapps","common"),StringComparison.OrdinalIgnoreCase)>=0;}
    private static string FindSteam()
    {
        foreach(var item in new[]{new[]{"HKCU","Software\\Valve\\Steam","SteamExe"},new[]{"HKLM","SOFTWARE\\WOW6432Node\\Valve\\Steam","InstallPath"}})
        try{RegistryKey root=item[0]=="HKCU"?Registry.CurrentUser:Registry.LocalMachine;using(var key=root.OpenSubKey(item[1])){string value=Convert.ToString(key==null?null:key.GetValue(item[2]));if(!String.IsNullOrWhiteSpace(value)){string file=value.EndsWith(".exe",StringComparison.OrdinalIgnoreCase)?value:Path.Combine(value,"steam.exe");if(File.Exists(file))return file;}}}catch{}
        string conventional=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Steam","steam.exe");return File.Exists(conventional)?conventional:null;
    }

    private static void EnsureCryptBase(string gameFolder,string runtimeFolder,Action<string> log)
    {
        string target=Path.Combine(gameFolder,"CryptBase.dll");if(File.Exists(target))return;
        string source=Path.Combine(runtimeFolder,"frosty-gpl","CryptBase.dll");
        if(!File.Exists(source))throw new FileNotFoundException("The Frosty CryptBase launch shim is missing",source);
        File.Copy(source,target,false);log("Installed Frosty's CryptBase.dll launch shim beside the game executable.");
    }
}
