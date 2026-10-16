using System;
using System.IO;
using System.Linq;
internal static class TestHeatFbPack
{
    static int Main(string[] args){if(args.Length!=2)throw new Exception("Usage: TestHeatFbPack pack output");var items=HeatFbPack.Inspect(args[0]);
        string[] expected={"UNITE Heat 3.5.fbmod","Handling Overhaul 3.0 (SIMCADE).fbmod","Handling Overhaul 3.0 (ARCADE).fbmod","UNITE Extreme Stance.fbmod","UNITE Basic Stance.fbmod"};
        if(items.Count!=expected.Length||!items.Select(x=>x.PackEntry).SequenceEqual(expected))throw new Exception("Manifest order mismatch");
        string[] enabled=items.Where(x=>x.Enabled).Select(x=>x.PackEntry).ToArray();
        if(!enabled.SequenceEqual(new[]{expected[0],expected[2],expected[4]}))throw new Exception("Safe default selection mismatch");
        foreach(var item in items.Where(x=>x.Enabled)){string extracted=HeatFbPack.Extract(item,args[1]);if(!File.Exists(extracted)||new FileInfo(extracted).Length==0)throw new Exception("Extraction failed");}
        Console.WriteLine("PASS FBPACK manifest, order, alternatives and selected component extraction.");return 0;}
}
