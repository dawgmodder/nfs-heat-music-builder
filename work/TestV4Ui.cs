using System;
using System.Drawing;
using System.Reflection;
using System.Windows.Forms;
internal static class TestV4Ui {
 [STAThread] static void Main(){
  Application.EnableVisualStyles();
  var a=Assembly.LoadFrom("work/HeatMusicInstallerV4.exe");var t=a.GetType("HeatMusicInstallerV3");
  using(var f=(Form)Activator.CreateInstance(t,true)){
   if(f.Icon==null||!f.Text.Contains("V4.1"))throw new Exception("Missing icon/version");
   f.Show();Application.DoEvents();
   var flags=BindingFlags.Instance|BindingFlags.NonPublic;
   ((CheckBox)t.GetField("notifications",flags).GetValue(f)).Checked=false;
   t.GetMethod("Status",flags).Invoke(f,new object[]{"Processing audio — normalization / cache",true});
   if(!((ProgressBar)t.GetField("progress",flags).GetValue(f)).Visible)throw new Exception("Missing busy state");
   t.GetMethod("Notify",flags).Invoke(f,new object[]{"Analysis complete","Your playlists are ready to configure.",false});
   if(((ProgressBar)t.GetField("progress",flags).GetValue(f)).Visible)throw new Exception("Busy state not cleared");
   using(var b=new Bitmap(f.Width,f.Height)){f.DrawToBitmap(b,new Rectangle(Point.Empty,b.Size));b.Save("output/v4-ui.png");}
   var tabs=(TabControl)t.GetField("tabs",flags).GetValue(f);
   tabs.SelectedIndex=1;Application.DoEvents();
   using(var b=new Bitmap(f.Width,f.Height)){f.DrawToBitmap(b,new Rectangle(Point.Empty,b.Size));b.Save("output/v41-editor.png");}
   f.Size=f.MinimumSize;tabs.SelectedIndex=0;Application.DoEvents();
   using(var b=new Bitmap(f.Width,f.Height)){f.DrawToBitmap(b,new Rectangle(Point.Empty,b.Size));b.Save("output/v41-minimum.png");}
   f.Close();
  }
  using(var icon=Icon.ExtractAssociatedIcon("work/HeatMusicInstallerV4.exe")){if(icon==null)throw new Exception("Missing executable icon");}
  Console.WriteLine("PASS form creation, embedded icon, V4 title, busy/completion state, muted notification and clean close. Windows balloon delivery not tested.");
 }
}
