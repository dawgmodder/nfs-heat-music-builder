using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;

// Build-time patch of a *workspace copy* of the exact local Frosty assembly.
// Suppress game launch and the informational first-install OK dialog. No game
// binaries or original Frosty runtime files are modified.
internal static class CreateNoLaunchFrostySupport
{
    private static readonly string Runtime = Environment.GetEnvironmentVariable("HEAT_MUSIC_FROSTY_RUNTIME") ?? @"C:\Users\WIN10\AppData\Local\HeatMusicReplacer\Runtime";
    private const string ExpectedSha = "81c350fd7fc35919457f27818cc73d9c410f214c77ef64e1ddb83149edbdf672";
    private static Assembly Resolve(object sender, ResolveEventArgs args)
    {
        string name=new AssemblyName(args.Name).Name;
        foreach(string folder in new[]{Runtime,Path.Combine(Runtime,"ThirdParty"),
            Path.Combine(Runtime,"Profiles"),Path.Combine(Runtime,"Plugins")})
        {
            string file=Path.Combine(folder,name+".dll");
            if(File.Exists(file))return Assembly.LoadFrom(file);
        }
        return null;
    }
    private static string Hash(byte[] bytes)
    {
        using(SHA256 sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes))
            .Replace("-","").ToLowerInvariant();
    }
    private static int FindUnique(byte[] haystack,byte[] needle)
    {
        int found=-1;
        for(int i=0;i<=haystack.Length-needle.Length;i++)
        {
            if(haystack[i]!=needle[0])continue;
            int j=1;while(j<needle.Length&&haystack[i+j]==needle[j])j++;
            if(j!=needle.Length)continue;
            if(found>=0)throw new InvalidDataException("Frosty IL sequence is not unique");
            found=i;
        }
        if(found<0)throw new InvalidDataException("Frosty IL sequence not found in PE file");
        return found;
    }
    private static int Main(string[] args)
    {
        try { Build(args); return 0; }
        catch(Exception error) { Console.Error.WriteLine(error); return 1; }
    }
    private static void Build(string[] args)
    {
        if(args.Length!=1)throw new ArgumentException("Workspace root required");
        string source=Path.Combine(Runtime,"FrostyModSupport.dll");
        string output=Path.Combine(Path.GetFullPath(args[0]),"work","NoLaunchRuntimeV3","FrostyModSupport.dll");
        byte[] original=File.ReadAllBytes(source);
        if(Hash(original)!=ExpectedSha)
            throw new InvalidDataException("Local FrostyModSupport.dll changed; no-launch patch refused");
        AppDomain.CurrentDomain.AssemblyResolve+=Resolve;
        Assembly assembly=Assembly.LoadFrom(source);
        Type executor=assembly.GetType("Frosty.ModSupport.FrostyModExecutor",true);
        MethodInfo run=executor.GetMethod("Run"),launch=executor.GetMethod("LaunchGame");
        if(!launch.IsStatic || launch.GetParameters().Length!=4)
            throw new InvalidDataException("Unexpected Frosty LaunchGame signature");
        byte[] il=run.GetMethodBody().GetILAsByteArray();
        int call=-1;
        for(int i=0;i+5<=il.Length;i++)
        {
            if(il[i]!=0x28)continue;
            int token=BitConverter.ToInt32(il,i+1);
            MethodBase target;
            try{target=run.Module.ResolveMethod(token);}catch{continue;}
            if(target.MetadataToken!=launch.MetadataToken||target.DeclaringType!=executor)continue;
            if(call>=0)throw new InvalidDataException("Multiple game-launch calls in Frosty Run");
            call=i;
        }
        if(call<16||call+16>=il.Length)
            throw new InvalidDataException("Expected Frosty game-launch call not found");
        byte[] window=il.Skip(call-16).Take(32).ToArray();
        int inFile=FindUnique(original,window)+16;
        if(!original.Skip(inFile).Take(5).SequenceEqual(il.Skip(call).Take(5)))
            throw new InvalidDataException("Frosty call-site bytes changed");
        byte[] patched=(byte[])original.Clone();
        for(int i=0;i<4;i++)patched[inFile+i]=0x26; // static call: four string arguments
        patched[inFile+4]=0x00; // keep the original five-byte instruction span
        // Exact v1.0.6.3 IL site: this dialog is informational (result discarded),
        // not Windows UAC. Leave all error dialogs and link validation intact.
        const int notice=0x0bad;
        if(il[notice]!=0x28||il[notice+5]!=0x26)
            throw new InvalidDataException("Unexpected first-install notice IL");
        MethodBase noticeMethod=run.Module.ResolveMethod(BitConverter.ToInt32(il,notice+1));
        if(noticeMethod.DeclaringType.FullName!="Frosty.Controls.FrostyMessageBox"||
            noticeMethod.Name!="Show"||noticeMethod.GetParameters().Length!=2)
            throw new InvalidDataException("Expected informational MessageBox.Show(string,string)");
        if(run.Module.ResolveString(BitConverter.ToInt32(il,0xb9f)).IndexOf(
            "Shortly you will be prompted for elevated privileges",StringComparison.Ordinal)<0)
            throw new InvalidDataException("First-install notice text changed");
        int noticeFile=FindUnique(original,il.Skip(notice-16).Take(32).ToArray())+16;
        // Pop two strings, return MessageBoxResult.OK, preserve offsets/stack.
        byte[] noNotice={0x26,0x26,0x17,0x00,0x00};
        Array.Copy(noNotice,0,patched,noticeFile,noNotice.Length);
        Directory.CreateDirectory(Path.GetDirectoryName(output));
        if(File.Exists(output))
        {
            if(Hash(File.ReadAllBytes(output))!=Hash(patched))
                throw new InvalidDataException("Unknown no-launch Frosty copy already exists");
        }
        else File.WriteAllBytes(output,patched);
        Console.WriteLine("NO_LAUNCH_FROSTY_READY "+output+" SHA256 "+Hash(patched));
    }
}
