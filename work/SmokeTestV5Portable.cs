using System;
using System.IO;
using System.Reflection;
using System.Collections;
using System.Windows.Forms;
internal static class PortableSmokeTest {
 [STAThread] static int Main(string[] args) {
  try {
   string root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
   var assembly=Assembly.LoadFrom(Path.Combine(root,"HeatMusicInstallerV5Beta7_3.exe"));
   var type=assembly.GetType("HeatMusicInstallerV3",true);
   Application.EnableVisualStyles();
   using(var form=(Form)Activator.CreateInstance(type,true)) {
    if(!form.Text.Contains("Beta 7.3"))throw new Exception("Wrong UI version");
    foreach(string field in new[]{"workspace","node","script"}) {
     string value=(string)type.GetField(field,BindingFlags.NonPublic|BindingFlags.Instance).GetValue(form);
     if(!value.StartsWith(root,StringComparison.OrdinalIgnoreCase))throw new Exception("Non-portable field: "+field);
     if(field!="workspace"&&!File.Exists(value))throw new Exception("Missing "+field);
     Console.WriteLine("PORTABLE_FIELD "+field+" "+value);
    }
    Console.WriteLine("FORM_CONSTRUCTED "+form.Text);
   }
   if(args.Length==2) {
    var pack=assembly.GetType("HeatFbPack",true);
    var choices=(IEnumerable)pack.GetMethod("Inspect",BindingFlags.Static|BindingFlags.Public).Invoke(null,new object[]{args[0]});
    int count=0;
    foreach(object choice in choices){var t=choice.GetType();Console.WriteLine("PACK_COMPONENT "+t.GetProperty("DisplayName").GetValue(choice,null));
     // Extract all to PRIVATE test output, not the distribution.
     var file=(string)pack.GetMethod("Extract",BindingFlags.Static|BindingFlags.Public).Invoke(null,new object[]{choice,args[1]});
     if(!File.Exists(file))throw new Exception("Extraction failed");count++;
    }
    if(count<1)throw new Exception("No components");Console.WriteLine("PACK_OK "+count);
   }
   return 0;
  } catch(Exception e){Console.Error.WriteLine(e);return 1;}
 }
}
