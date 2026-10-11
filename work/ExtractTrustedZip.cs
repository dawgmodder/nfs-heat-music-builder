using System;
using System.IO;
using System.IO.Compression;

internal static class ExtractTrustedZip
{
    private static int Main(string[] args)
    {
        try
        {
            if(args.Length!=2)throw new ArgumentException("Archive and destination required");
            string destination=Path.GetFullPath(args[1]);
            if(Directory.Exists(destination))throw new IOException("Destination already exists");
            Directory.CreateDirectory(destination);
            using(ZipArchive archive=ZipFile.OpenRead(Path.GetFullPath(args[0])))
            foreach(ZipArchiveEntry entry in archive.Entries)
            {
                string item=Path.GetFullPath(Path.Combine(destination,entry.FullName.Replace('/',Path.DirectorySeparatorChar)));
                if(!item.StartsWith(destination+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("Unsafe archive path");
                if(entry.FullName.EndsWith("/",StringComparison.Ordinal)){
                    Directory.CreateDirectory(item);continue;
                }
                Directory.CreateDirectory(Path.GetDirectoryName(item));
                entry.ExtractToFile(item,false);
            }
            Console.WriteLine("ARCHIVE_EXTRACTED "+destination);
            return 0;
        }
        catch(Exception error){Console.Error.WriteLine(error);return 1;}
    }
}
