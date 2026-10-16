using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Web.Script.Serialization;

internal sealed class HeatModChoice
{
    public string SourcePath { get; set; }
    public string PackName { get; set; }
    public string PackEntry { get; set; }
    public string DisplayName { get; set; }
    public bool Enabled { get; set; }
    public bool IsPackComponent { get { return !String.IsNullOrEmpty(PackEntry); } }
    public override string ToString(){return String.IsNullOrEmpty(PackName)?DisplayName:PackName+"  /  "+DisplayName;}
}

internal static class HeatFbPack
{
    private sealed class Manifest
    {
        public string name { get; set; }
        public string managerVersion { get; set; }
        public int version { get; set; }
        public string[] mods { get; set; }
    }

    public static List<HeatModChoice> Inspect(string file)
    {
        if(!File.Exists(file))throw new FileNotFoundException("FBPACK was not found",file);
        using(var archive=ZipFile.OpenRead(file)){
            var manifestEntry=archive.Entries.SingleOrDefault(e=>String.Equals(e.FullName,"manifest.json",StringComparison.OrdinalIgnoreCase));
            if(manifestEntry==null)throw new InvalidDataException("FBPACK has no manifest.json");
            Manifest manifest;
            using(var reader=new StreamReader(manifestEntry.Open()))manifest=new JavaScriptSerializer().Deserialize<Manifest>(reader.ReadToEnd());
            if(manifest==null||manifest.version!=1||manifest.mods==null||manifest.mods.Length==0)
                throw new InvalidDataException("Unsupported or empty FBPACK manifest");
            var entries=archive.Entries.ToDictionary(e=>e.FullName,StringComparer.OrdinalIgnoreCase);
            var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);var result=new List<HeatModChoice>();
            foreach(string name in manifest.mods){
                if(String.IsNullOrWhiteSpace(name)||Path.GetFileName(name)!=name||!name.EndsWith(".fbmod",StringComparison.OrdinalIgnoreCase)||!seen.Add(name))
                    throw new InvalidDataException("Unsafe or duplicate FBPACK component: "+name);
                ZipArchiveEntry entry;if(!entries.TryGetValue(name,out entry)||entry.Length<=0)throw new InvalidDataException("FBPACK component is missing: "+name);
                bool enabled=name.IndexOf("SIMCADE",StringComparison.OrdinalIgnoreCase)<0&&name.IndexOf("Extreme Stance",StringComparison.OrdinalIgnoreCase)<0;
                result.Add(new HeatModChoice{SourcePath=Path.GetFullPath(file),PackName=String.IsNullOrWhiteSpace(manifest.name)?Path.GetFileNameWithoutExtension(file):manifest.name,
                    PackEntry=name,DisplayName=Path.GetFileNameWithoutExtension(name),Enabled=enabled});
            }
            return result;
        }
    }

    public static string Extract(HeatModChoice choice,string cacheRoot)
    {
        if(!choice.IsPackComponent)return choice.SourcePath;
        string packHash=HashFile(choice.SourcePath);string folder=Path.Combine(cacheRoot,packHash);Directory.CreateDirectory(folder);
        string target=Path.Combine(folder,choice.PackEntry);string fullFolder=Path.GetFullPath(folder)+Path.DirectorySeparatorChar;
        if(!Path.GetFullPath(target).StartsWith(fullFolder,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Unsafe FBPACK target");
        if(File.Exists(target)&&new FileInfo(target).Length>0)return target;
        using(var archive=ZipFile.OpenRead(choice.SourcePath)){
            var entry=archive.Entries.SingleOrDefault(e=>String.Equals(e.FullName,choice.PackEntry,StringComparison.OrdinalIgnoreCase));
            if(entry==null||entry.Length<=0)throw new InvalidDataException("FBPACK component disappeared: "+choice.PackEntry);
            string temporary=target+".building";using(var input=entry.Open())using(var output=new FileStream(temporary,FileMode.Create,FileAccess.Write,FileShare.None))input.CopyTo(output);
            if(new FileInfo(temporary).Length!=entry.Length){File.Delete(temporary);throw new InvalidDataException("FBPACK component extraction was incomplete: "+choice.PackEntry);}
            File.Move(temporary,target);
        }
        return target;
    }

    private static string HashFile(string file){using(var sha=SHA256.Create())using(var stream=File.OpenRead(file))return String.Concat(sha.ComputeHash(stream).Select(b=>b.ToString("x2")));}
}
