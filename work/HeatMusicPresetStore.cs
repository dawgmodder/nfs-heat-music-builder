using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

internal static class HeatMusicPresetStore
{
    public sealed class Song { public string name{get;set;} public string entry{get;set;}
        public string sha256{get;set;} public long bytes{get;set;} public double duration{get;set;} }
    public sealed class Preset { public string format{get;set;} public int version{get;set;}
        public Song[] songs{get;set;} public HeatMusicPlanEditor.EditedPlan plan{get;set;}
        public Blob[] cache{get;set;} }
    public sealed class Blob { public string entry{get;set;} public string sha256{get;set;} public long bytes{get;set;} }
    static readonly string[] Keys={"garage","freeDriveDay","freeDriveNight","raceDay","raceNight"};
    static readonly int[] Caps={12,10,16,10,11};
    static readonly string[] Exts={".wav",".mp3",".flac",".m4a"};
    const long MaxSong=1024L*1024*1024,MaxTotal=20L*1024*1024*1024;
    static JavaScriptSerializer Json(){return new JavaScriptSerializer{MaxJsonLength=8*1024*1024};}
    static string CopyHash(Stream input,Stream output,long expected){
        using(var sha=SHA256.Create()){
            byte[] buffer=new byte[131072];long total=0;int n;
            while((n=input.Read(buffer,0,buffer.Length))>0){total+=n;
                if(total>expected||total>MaxSong)throw new InvalidDataException("Audio file exceeds its declared size.");
                output.Write(buffer,0,n);sha.TransformBlock(buffer,0,n,null,0);
            }
            if(total!=expected)throw new InvalidDataException("Incomplete audio file.");
            sha.TransformFinalBlock(new byte[0],0,0);
            return BitConverter.ToString(sha.Hash).Replace("-","").ToLowerInvariant();
        }
    }
    static void Validate(Preset p){
        if(p==null||p.format!="heat-music-preset"||(p.version!=1&&p.version!=2)||p.songs==null||p.songs.Length<1||p.songs.Length>500||
           p.plan==null||p.plan.version!=1||p.plan.playlists==null||p.plan.drops==null||p.plan.drops.Length!=p.songs.Length)
            throw new InvalidDataException("Invalid preset format or unsupported version.");
        long total=0;
        for(int i=0;i<p.songs.Length;i++){
            Song s=p.songs[i];
            if(s==null||String.IsNullOrWhiteSpace(s.name)||s.name.Length>240||
               s.name.IndexOfAny(Path.GetInvalidFileNameChars())>=0||!Exts.Contains(Path.GetExtension(s.name).ToLowerInvariant())||
               s.entry!="music/"+(i+1).ToString("000")+Path.GetExtension(s.name).ToLowerInvariant()||
               s.bytes<=0||s.bytes>MaxSong||Double.IsNaN(s.duration)||Double.IsInfinity(s.duration)||s.duration<20||
               String.IsNullOrEmpty(s.sha256)||!System.Text.RegularExpressions.Regex.IsMatch(s.sha256,"^[0-9a-f]{64}$"))
                throw new InvalidDataException("Invalid track in preset: "+i);
            total+=s.bytes;
            double d=p.plan.drops[i];
            if(Double.IsNaN(d)||d<16.2||d>Math.Min(150,s.duration-8))throw new InvalidDataException("Invalid drop in preset (minimum 16.2 seconds).");
        }
        if(p.cache!=null){
            if(p.version!=2||p.cache.Length>10000)throw new InvalidDataException("Invalid preset cache.");
            var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach(var b in p.cache){
                if(b==null||b.entry==null||!System.Text.RegularExpressions.Regex.IsMatch(b.entry,@"\Acache/[0-9a-f]{64}\.(json|wav|ealayer3)\z")||
                    !names.Add(b.entry)||b.bytes<=0||b.bytes>MaxSong||b.sha256==null||
                    !System.Text.RegularExpressions.Regex.IsMatch(b.sha256,@"\A[0-9a-f]{64}\z")||
                    (b.entry.EndsWith(".json")&&b.bytes>65536))throw new InvalidDataException("Invalid cache file.");
                total+=b.bytes;
            }
        }
        if(total>MaxTotal)throw new InvalidDataException("Preset exceeds 20 GB of audio and cache.");
        for(int k=0;k<Keys.Length;k++){
            List<int> list;
            if(!p.plan.playlists.TryGetValue(Keys[k],out list)||list==null||list.Count<1||list.Count>Caps[k]||list.Distinct().Count()!=list.Count||
               list.Any(i=>i<0||i>=p.songs.Length||(k>=3&&p.songs[i].duration<30)))
                throw new InvalidDataException("Invalid playlist in preset: "+Keys[k]);
        }
        if(p.plan.menu<0||p.plan.menu>=p.songs.Length)
            throw new InvalidDataException("Invalid menu track in preset.");
    }
    public static int Export(string reportFile,string planFile,string destination,string cacheRoot=null){
        var json=Json();var report=json.Deserialize<HeatMusicPlanEditor.Report>(File.ReadAllText(reportFile));
        var plan=json.Deserialize<HeatMusicPlanEditor.EditedPlan>(File.ReadAllText(planFile));
        if(report==null||report.tracks==null||report.tracks.Length<1||report.tracks.Length>500||
           report.tracks.Sum(t=>new FileInfo(t.stagedSource).Length)>MaxTotal)
            throw new InvalidDataException("Invalid preset or music exceeds 20 GB.");
        var p=new Preset{format="heat-music-preset",version=2,plan=plan,songs=new Song[report.tracks.Length]};
        string temp=destination+"."+Guid.NewGuid().ToString("N")+".tmp";
        try{
            using(var file=new FileStream(temp,FileMode.CreateNew,FileAccess.Write))
            using(var zip=new ZipArchive(file,ZipArchiveMode.Create)){
                for(int i=0;i<report.tracks.Length;i++){
                    var track=report.tracks[i];string name=track.displayName??Path.GetFileName(track.file);
                    string entry="music/"+(i+1).ToString("000")+Path.GetExtension(name).ToLowerInvariant();
                    long bytes=new FileInfo(track.stagedSource).Length;
                    if(bytes>MaxSong)throw new InvalidDataException("Track exceeds 1 GB.");
                    string hash;
                    using(var input=File.OpenRead(track.stagedSource))
                    using(var output=zip.CreateEntry(entry,CompressionLevel.Fastest).Open())hash=CopyHash(input,output,bytes);
                    p.songs[i]=new Song{name=name,entry=entry,bytes=bytes,sha256=hash,duration=track.duration};
                }
                var blobs=new List<Blob>();var seen=new HashSet<string>();
                var owners=new HashSet<string>(p.songs.Select(s=>s.sha256));
                long total=p.songs.Sum(s=>s.bytes);
                foreach(string dir in new[]{cacheRoot,Path.Combine(Path.GetDirectoryName(reportFile),"audio-cache")}){
                    if(String.IsNullOrEmpty(dir)||!Directory.Exists(dir))continue;
                    foreach(string recordFile in Directory.EnumerateFiles(dir,"*.json")){
                        string key=Path.GetFileNameWithoutExtension(recordFile);
                        if(!System.Text.RegularExpressions.Regex.IsMatch(key,@"\A[0-9a-f]{64}\z")||seen.Contains(key)||new FileInfo(recordFile).Length>65536)continue;
                        Dictionary<string,object> record;
                        try{record=json.Deserialize<Dictionary<string,object>>(File.ReadAllText(recordFile));}catch{continue;}
                        object owner,extObj;
                        if(record==null||!record.TryGetValue("owner",out owner)||!owners.Contains(owner as string))continue;
                        string ext=record.TryGetValue("ext",out extObj)?extObj as string:null;
                        if(ext!=null&&ext!=".wav"&&ext!=".ealayer3")continue;
                        string asset=ext==null?null:Path.Combine(dir,key+ext);
                        if(asset!=null&&!File.Exists(asset))continue;
                        foreach(string source in asset==null?new[]{recordFile}:new[]{recordFile,asset}){
                            long bytes=new FileInfo(source).Length;total+=bytes;
                            if(bytes<=0||bytes>MaxSong||total>MaxTotal)throw new InvalidDataException("Preset with cache exceeds the size limit.");
                            string entry="cache/"+Path.GetFileName(source),hash;
                            using(var input=File.OpenRead(source))using(var output=zip.CreateEntry(entry,CompressionLevel.Fastest).Open())hash=CopyHash(input,output,bytes);
                            blobs.Add(new Blob{entry=entry,sha256=hash,bytes=bytes});
                        }
                        seen.Add(key);
                    }
                }
                p.cache=blobs.ToArray();Validate(p);
                using(var writer=new StreamWriter(zip.CreateEntry("preset.json").Open(),new UTF8Encoding(false)))writer.Write(json.Serialize(p));
            }
            if(File.Exists(destination))File.Replace(temp,destination,null);else File.Move(temp,destination);
            return p.cache.Count(b=>b.entry.EndsWith(".ealayer3"));
        }finally{if(File.Exists(temp))File.Delete(temp);}
    }
    public static string Import(string presetFile,string plansRoot){
        using(var file=File.OpenRead(presetFile))
        using(var zip=new ZipArchive(file,ZipArchiveMode.Read)){
            var header=zip.GetEntry("preset.json");
            if(header==null||header.Length<1||header.Length>8*1024*1024)throw new InvalidDataException("Preset manifest is missing or too large.");
            Preset p;using(var data=new MemoryStream())using(var input=header.Open()){
                CopyHash(input,data,header.Length);p=Json().Deserialize<Preset>(Encoding.UTF8.GetString(data.ToArray()));
            }
            Validate(p);
            var allowed=new HashSet<string>(p.songs.Select(s=>s.entry).Concat((p.cache??new Blob[0]).Select(b=>b.entry)),StringComparer.OrdinalIgnoreCase);allowed.Add("preset.json");
            if(zip.Entries.Count!=allowed.Count||zip.Entries.Any(e=>!allowed.Remove(e.FullName)))
                throw new InvalidDataException("Preset contains extra entries, duplicates or disallowed paths.");
            if(new DriveInfo(Path.GetPathRoot(Path.GetFullPath(plansRoot))).AvailableFreeSpace<p.songs.Sum(s=>s.bytes)+(p.cache??new Blob[0]).Sum(b=>b.bytes)+256L*1024*1024)
                throw new IOException("Not enough space to import preset music.");
            // Leave room for 64-character content hashes on .NET/Windows legacy paths.
            string dir=Path.Combine(plansRoot,"HeatPreset_"+Guid.NewGuid().ToString("N").Substring(0,16));
            if(Directory.Exists(dir))throw new IOException("Import folder already exists; please try again.");
            string sources=Path.Combine(dir,"sources");Directory.CreateDirectory(sources);
            try{
                var tracks=new HeatMusicPlanEditor.Track[p.songs.Length];
                for(int i=0;i<p.songs.Length;i++){
                    Song s=p.songs[i];var entry=zip.GetEntry(s.entry);
                    if(entry==null||entry.Length!=s.bytes)throw new InvalidDataException("Incorrect track size in preset.");
                    string source=Path.Combine(sources,(i+1).ToString("000")+Path.GetExtension(s.name).ToLowerInvariant());
                    string hash;using(var input=entry.Open())using(var output=new FileStream(source,FileMode.CreateNew))hash=CopyHash(input,output,s.bytes);
                    if(hash!=s.sha256)throw new InvalidDataException("Corrupted track in preset: "+s.name);
                    tracks[i]=new HeatMusicPlanEditor.Track{file=source,stagedSource=source,displayName=s.name,duration=s.duration,dropSeconds=p.plan.drops[i]};
                }
                var report=new HeatMusicPlanEditor.Report{sourceDir=sources,tracks=tracks,menu=tracks[p.plan.menu].file,
                    assignments=Keys.ToDictionary(k=>k,k=>p.plan.playlists[k].Select(i=>tracks[i].file).ToArray())};
                if(p.cache!=null&&p.cache.Length>0){
                    string cacheDir=Path.Combine(dir,"audio-cache");Directory.CreateDirectory(cacheDir);
                    foreach(var b in p.cache){
                        var entry=zip.GetEntry(b.entry);
                        if(entry==null||entry.Length!=b.bytes)throw new InvalidDataException("Incomplete preset cache.");
                        string hash;
                        using(var input=entry.Open())using(var output=new FileStream(Path.Combine(cacheDir,b.entry.Substring(6)),FileMode.CreateNew))hash=CopyHash(input,output,b.bytes);
                        if(hash!=b.sha256)throw new InvalidDataException("Corrupted converted audio in preset.");
                    }
                }
                string reportFile=Path.Combine(dir,"report.json");
                File.WriteAllText(reportFile,Json().Serialize(report),new UTF8Encoding(false));
                File.WriteAllText(Path.Combine(dir,"editor.json"),Json().Serialize(p.plan),new UTF8Encoding(false));
                return reportFile;
            }catch{Directory.Delete(dir,true);throw;}
        }
    }
}
