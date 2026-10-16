using System;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

internal static class TestHeatManagerState
{
    [STAThread]
    private static void Main()
    {
        string root=Path.Combine(Path.GetTempPath(),"heat-v5-state-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);string node=Path.Combine(root,"node.exe");File.WriteAllText(node,"test");
        string first=Path.Combine(root,"first.fbmod"),second=Path.Combine(root,"second.fbmod"),music=Path.Combine(root,"music.fbmod");
        File.WriteAllText(first,"first");File.WriteAllText(second,"second");File.WriteAllText(music,"music");
        var flags=BindingFlags.Instance|BindingFlags.NonPublic;
        using(var panel=new HeatMusicModManagerPanel(root,node,()=>root,(a,b,c)=>{})){panel.CreateControl();
            MethodInfo add=typeof(HeatMusicModManagerPanel).GetMethod("AddChoice",flags);
            add.Invoke(panel,new object[]{new HeatModChoice{SourcePath=first,DisplayName="First",Enabled=false}});
            add.Invoke(panel,new object[]{new HeatModChoice{SourcePath=second,DisplayName="Second",Enabled=true}});
            panel.SelectSoundtrack(music);
            typeof(HeatMusicModManagerPanel).GetMethod("SaveState",flags).Invoke(panel,null);
        }
        using(var restored=new HeatMusicModManagerPanel(root,node,()=>root,(a,b,c)=>{})){
            var list=(CheckedListBox)typeof(HeatMusicModManagerPanel).GetField("mods",flags).GetValue(restored);
            string restoredMusic=(string)typeof(HeatMusicModManagerPanel).GetField("soundtrackPath",flags).GetValue(restored);
            if(list.Items.Count!=2||((HeatModChoice)list.Items[0]).DisplayName!="First"||((HeatModChoice)list.Items[1]).DisplayName!="Second")
                throw new Exception("Saved load order was not restored.");
            if(list.GetItemChecked(0)||!list.GetItemChecked(1))throw new Exception("Saved selections were not restored.");
            if(!String.Equals(restoredMusic,music,StringComparison.OrdinalIgnoreCase))throw new Exception("Saved soundtrack was not restored.");
        }
        Console.WriteLine("PASS V5 selection, order and soundtrack persistence after reopening.");
    }
}
