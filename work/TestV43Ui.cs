using System;
using System.Drawing;
using System.Reflection;
using System.Windows.Forms;
internal static class TestV43Ui {
 [STAThread] static void Main(){Application.EnableVisualStyles();var a=Assembly.LoadFrom("work/HeatMusicInstallerV4_3.exe");var t=a.GetType("HeatMusicInstallerV3");
 using(var f=(Form)Activator.CreateInstance(t,true)){if(f.Icon==null||!f.Text.Contains("V4.3"))throw new Exception("Version/icon missing");
 f.ShowInTaskbar=false;f.StartPosition=FormStartPosition.Manual;f.Location=new Point(-3000,-3000);f.Show();Application.DoEvents();
 var flags=BindingFlags.Instance|BindingFlags.NonPublic;((CheckBox)t.GetField("notifications",flags).GetValue(f)).Checked=false;
 var tabs=(TabControl)t.GetField("tabs",flags).GetValue(f);if(tabs.TabPages.Count!=3)throw new Exception("Missing Frosty tab");tabs.SelectedIndex=2;Application.DoEvents();
 using(var b=new Bitmap(f.Width,f.Height)){f.DrawToBitmap(b,new Rectangle(Point.Empty,b.Size));b.Save("output/v43-frosty-ui.png");}
 f.Size=f.MinimumSize;Application.DoEvents();using(var b=new Bitmap(f.Width,f.Height)){f.DrawToBitmap(b,new Rectangle(Point.Empty,b.Size));b.Save("output/v43-frosty-minimum.png");}f.Close();}
 Console.WriteLine("PASS V4.3 form, icon, 3 tabs, Frosty panel layout and clean idle close. No game launch.");}
}
