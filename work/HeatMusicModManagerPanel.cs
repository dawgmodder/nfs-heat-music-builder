using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class HeatMusicModManagerPanel : UserControl
{
    private readonly string workspace,node;
    private readonly Func<string> gameFolder;
    private readonly Action<string,string,bool> notify;
    private readonly ListBox mods=new ListBox();
    private readonly Label soundtrack=new Label();
    private readonly Button launch=new Button();
    private readonly TextBox log=new TextBox();
    private Process running;
    private string soundtrackPath;
    public bool Busy{get{return running!=null;}}
    public event Action Finished;

    public HeatMusicModManagerPanel(string root,string nodePath,Func<string> game,Action<string,string,bool> notification)
    {
        workspace=root;node=nodePath;gameFolder=game;notify=notification;Dock=DockStyle.Fill;
        BackColor=HeatVisualTheme.Asphalt;ForeColor=HeatVisualTheme.Text;
        var layout=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(28,24,28,24),ColumnCount=2,RowCount=6};
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,72));layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,28));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,72));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,44));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent,45));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,48));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,58));layout.RowStyles.Add(new RowStyle(SizeType.Percent,55));
        var title=new Label{Text="ONE LOAD ORDER. ONE LAUNCH.",Dock=DockStyle.Fill,Font=HeatVisualTheme.Ui(22,FontStyle.Bold)};
        var help=new Label{Text="Add UNITE and any other FBMODs below. The generated soundtrack is always applied last.",Dock=DockStyle.Fill,ForeColor=HeatVisualTheme.Muted};
        layout.Controls.Add(title,0,0);layout.SetColumnSpan(title,2);layout.Controls.Add(help,0,1);layout.SetColumnSpan(help,2);
        mods.Dock=DockStyle.Fill;mods.BackColor=HeatVisualTheme.Void;mods.ForeColor=HeatVisualTheme.Text;mods.BorderStyle=BorderStyle.FixedSingle;
        layout.Controls.Add(mods,0,2);
        var buttons=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new Padding(12,0,0,0)};
        foreach(var button in new[]{MakeButton("ADD FBMOD",AddMods),MakeButton("REMOVE",RemoveMod),MakeButton("MOVE UP",MoveUp),MakeButton("MOVE DOWN",MoveDown)})buttons.Controls.Add(button);
        layout.Controls.Add(buttons,1,2);
        soundtrack.Dock=DockStyle.Fill;soundtrack.TextAlign=ContentAlignment.MiddleLeft;soundtrack.ForeColor=HeatVisualTheme.Muted;
        layout.Controls.Add(soundtrack,0,3);layout.SetColumnSpan(soundtrack,2);UpdateSoundtrack();
        launch.Text="APPLY MODS AND LAUNCH";launch.Dock=DockStyle.Fill;HeatVisualTheme.StyleButton(launch,true);launch.Click+=(s,e)=>ApplyAndLaunch();
        layout.Controls.Add(launch,0,4);layout.SetColumnSpan(launch,2);
        log.Dock=DockStyle.Fill;log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;log.BackColor=HeatVisualTheme.Void;
        log.ForeColor=Color.FromArgb(213,226,232);log.Font=new Font("Consolas",9);log.BorderStyle=BorderStyle.None;
        layout.Controls.Add(log,0,5);layout.SetColumnSpan(log,2);Controls.Add(layout);
    }

    private Button MakeButton(string text,EventHandler click){var button=new Button{Text=text,Width=190,Height=36,Margin=new Padding(0,0,0,8)};HeatVisualTheme.StyleButton(button);button.Click+=click;return button;}
    private void AddMods(object sender,EventArgs e){using(var d=new OpenFileDialog{Filter="Frosty mods (*.fbmod)|*.fbmod",Multiselect=true,CheckFileExists=true})if(d.ShowDialog(this)==DialogResult.OK)foreach(string file in d.FileNames)if(!mods.Items.Contains(file)&&!String.Equals(file,soundtrackPath,StringComparison.OrdinalIgnoreCase))mods.Items.Add(file);}
    private void RemoveMod(object sender,EventArgs e){if(mods.SelectedIndex>=0)mods.Items.RemoveAt(mods.SelectedIndex);}
    private void MoveUp(object sender,EventArgs e){MoveSelected(-1);}private void MoveDown(object sender,EventArgs e){MoveSelected(1);}
    private void MoveSelected(int delta){int from=mods.SelectedIndex,to=from+delta;if(from<0||to<0||to>=mods.Items.Count)return;object item=mods.Items[from];mods.Items.RemoveAt(from);mods.Items.Insert(to,item);mods.SelectedIndex=to;}
    public void SelectSoundtrack(string file){if(File.Exists(file)){soundtrackPath=Path.GetFullPath(file);UpdateSoundtrack();}}
    private void UpdateSoundtrack(){soundtrack.Text=String.IsNullOrEmpty(soundtrackPath)?"SOUNDTRACK: build or select a soundtrack first":"SOUNDTRACK (APPLIED LAST): "+Path.GetFileName(soundtrackPath);}
    public void CancelSafely(){try{if(running!=null&&!running.HasExited)running.CloseMainWindow();}catch{} }

    private void ApplyAndLaunch()
    {
        if(Busy)return;string game=gameFolder();string exe=Path.Combine(game,"NeedForSpeedHeat.exe");
        if(!File.Exists(exe)){MessageBox.Show(this,"Select the NFS Heat game folder first.");return;}
        if(String.IsNullOrEmpty(soundtrackPath)||!File.Exists(soundtrackPath)){MessageBox.Show(this,"Build a soundtrack FBMOD first.");return;}
        string cli=Path.Combine(workspace,"runtime","frosty-gpl","FrostyCli.dll");
        string dotnet=Path.Combine(workspace,"runtime","dotnet8","dotnet.exe");
        string key=Path.Combine(workspace,"runtime","FrostyEditor","NFSHEAT.key");
        string script=Path.Combine(workspace,"work","FrostyGplManager.js");
        foreach(string required in new[]{node,cli,dotnet,key,script})if(!File.Exists(required)){MessageBox.Show(this,"V5 runtime component is missing:\n"+required);return;}
        var selected=new List<string>();foreach(object item in mods.Items)selected.Add(Convert.ToString(item));
        string session=Path.Combine(workspace,"output","frosty-v5-session");Directory.CreateDirectory(session);
        string modData=Path.Combine(game,"ModData","HeatMusicV5");string config=Path.Combine(session,"manager-config.json");
        var data=new Dictionary<string,object>{{"gameExe",exe},{"frostyCli",cli},{"dotnet",dotnet},{"initFsKey",key},
            {"workDir",Path.Combine(session,"work")},{"modDataDir",modData},{"mods",selected.ToArray()},{"musicMod",soundtrackPath}};
        File.WriteAllText(config,new JavaScriptSerializer().Serialize(data),new UTF8Encoding(false));
        launch.Enabled=false;log.Clear();Append("Preparing combined Frosty profile...");
        running=new Process{StartInfo=new ProcessStartInfo{FileName=node,Arguments="\""+script+"\" \""+config+"\"",WorkingDirectory=workspace,
            UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8},EnableRaisingEvents=true};
        var process=running;process.OutputDataReceived+=(s,a)=>{if(a.Data!=null)Append(a.Data);};process.ErrorDataReceived+=(s,a)=>{if(a.Data!=null)Append("ERROR "+a.Data);};
        process.Exited+=(s,a)=>{process.WaitForExit();int code=process.ExitCode;BeginInvoke(new Action(()=>{running=null;launch.Enabled=true;process.Dispose();
            if(code==0){notify("Mods ready","Launching NFS Heat with the combined profile.",false);try{Process.Start(new ProcessStartInfo{FileName=exe,Arguments="-dataPath \"ModData/HeatMusicV5\"",WorkingDirectory=game,UseShellExecute=true});}catch(Exception ex){MessageBox.Show(this,"Profile ready, but launch failed: "+ex.Message);}}
            else notify("Frosty apply failed","Open the manager log for details.",true);if(Finished!=null)Finished();}));};
        try{process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();}catch(Exception ex){running=null;launch.Enabled=true;process.Dispose();MessageBox.Show(this,ex.Message);}
    }
    private void Append(string text){if(InvokeRequired){BeginInvoke(new Action<string>(Append),text);return;}log.AppendText(text+Environment.NewLine);}
}
