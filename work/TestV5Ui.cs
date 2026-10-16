using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
internal static class TestV5Ui {
 [STAThread] static void Main(string[] args){Application.EnableVisualStyles();string executable=args.Length>0?Path.GetFullPath(args[0]):Path.GetFullPath("work/HeatMusicInstallerV5Preview.exe");var a=Assembly.LoadFrom(executable);var t=a.GetType("HeatMusicInstallerV3");
 using(var f=(Form)Activator.CreateInstance(t,true)){if(f.Icon==null||!f.Text.Contains("V5"))throw new Exception("Version/icon missing");
 f.ShowInTaskbar=false;f.StartPosition=FormStartPosition.Manual;f.Location=new Point(-3000,-3000);f.Show();Application.DoEvents();
 var flags=BindingFlags.Instance|BindingFlags.NonPublic;((CheckBox)t.GetField("notifications",flags).GetValue(f)).Checked=false;
 var tabs=(TabControl)t.GetField("tabs",flags).GetValue(f);if(tabs.TabPages.Count!=3||tabs.TabPages[2].Text!="Mods & Launch")throw new Exception("Missing manager tab");
 tabs.SelectedIndex=2;Application.DoEvents();var panel=t.GetField("frostyPanel",flags).GetValue(f) as Control;if(panel==null)throw new Exception("Manager panel missing");
 bool hasLaunch=false;foreach(Control c in panel.Controls)hasLaunch|=FindButton(c,"APPLY MODS AND LAUNCH");if(!hasLaunch)throw new Exception("One-click launch button missing");
 f.Close();}Console.WriteLine("PASS V5 form, icon, manager tab, one-click Launch and clean idle close. No game launch.");}
 static bool FindButton(Control root,string text){if(root is Button&&root.Text==text)return true;foreach(Control child in root.Controls)if(FindButton(child,text))return true;return false;}
}
