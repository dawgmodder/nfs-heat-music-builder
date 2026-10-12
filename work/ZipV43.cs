using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
internal static class ZipV43 {
 static void Main(string[] args){if(args.Length!=2||File.Exists(args[1]))throw new Exception("New archive path required");
 ZipFile.CreateFromDirectory(args[0],args[1],CompressionLevel.Optimal,true);
 using(var z=ZipFile.OpenRead(args[1])){if(!z.Entries.Any(e=>e.FullName.EndsWith("HeatMusicInstallerV4_3.exe")))throw new Exception("Executable missing");
 foreach(var e in z.Entries)if(new[]{".key",".fbmod",".ealayer3",".mp3",".wav",".flac",".cas"}.Any(x=>e.FullName.EndsWith(x,StringComparison.OrdinalIgnoreCase)))throw new Exception("Private/game/audio data in clean archive: "+e.FullName);
 Console.WriteLine("CLEAN_ZIP_VERIFIED "+z.Entries.Count+" entries");}}
}
