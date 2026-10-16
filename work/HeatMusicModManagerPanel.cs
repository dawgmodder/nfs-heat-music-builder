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
    private readonly CheckedListBox mods=new CheckedListBox();
    private readonly Label soundtrack=new Label();
    private readonly Button launch=new Button();
    private readonly TextBox log=new TextBox();
    private Process running;
    private string soundtrackPath;
    private string cancelPath;
    private bool changingChecks;
    private string StatePath{get{return Path.Combine(workspace,"output","frosty-v5-manager-state.json");}}
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
        var help=new Label{Text="Import the original UNITE FBPACK or add individual FBMODs. Choose components below; the soundtrack is always applied last.",Dock=DockStyle.Fill,ForeColor=HeatVisualTheme.Muted};
        layout.Controls.Add(title,0,0);layout.SetColumnSpan(title,2);layout.Controls.Add(help,0,1);layout.SetColumnSpan(help,2);
        mods.Dock=DockStyle.Fill;mods.BackColor=HeatVisualTheme.Void;mods.ForeColor=HeatVisualTheme.Text;mods.BorderStyle=BorderStyle.FixedSingle;mods.CheckOnClick=true;
        mods.ItemCheck+=HandleItemCheck;
        layout.Controls.Add(mods,0,2);
        var buttons=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,Padding=new Padding(12,0,0,0)};
        foreach(var button in new[]{MakeButton("IMPORT FBPACK",ImportPack),MakeButton("ADD FBMOD",AddMods),MakeButton("REMOVE",RemoveMod),MakeButton("MOVE UP",MoveUp),MakeButton("MOVE DOWN",MoveDown)})buttons.Controls.Add(button);
        layout.Controls.Add(buttons,1,2);
        soundtrack.Dock=DockStyle.Fill;soundtrack.TextAlign=ContentAlignment.MiddleLeft;soundtrack.ForeColor=HeatVisualTheme.Muted;
        layout.Controls.Add(soundtrack,0,3);layout.SetColumnSpan(soundtrack,2);UpdateSoundtrack();
        launch.Text="APPLY MODS AND LAUNCH";launch.Dock=DockStyle.Fill;HeatVisualTheme.StyleButton(launch,true);launch.Click+=(s,e)=>ApplyAndLaunch();
        layout.Controls.Add(launch,0,4);layout.SetColumnSpan(launch,2);
        log.Dock=DockStyle.Fill;log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;log.BackColor=HeatVisualTheme.Void;
        log.ForeColor=Color.FromArgb(213,226,232);log.Font=new Font("Consolas",9);log.BorderStyle=BorderStyle.None;
        layout.Controls.Add(log,0,5);layout.SetColumnSpan(log,2);Controls.Add(layout);LoadState();
    }

    private Button MakeButton(string text,EventHandler click){var button=new Button{Text=text,Width=190,Height=36,Margin=new Padding(0,0,0,8)};HeatVisualTheme.StyleButton(button);button.Click+=click;return button;}
    private void ImportPack(object sender,EventArgs e){using(var d=new OpenFileDialog{Filter="Frosty packs (*.fbpack)|*.fbpack",CheckFileExists=true})if(d.ShowDialog(this)==DialogResult.OK)try{foreach(var item in HeatFbPack.Inspect(d.FileName))AddChoice(item);SaveState();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Invalid FBPACK",MessageBoxButtons.OK,MessageBoxIcon.Error);}}
    private void AddMods(object sender,EventArgs e){using(var d=new OpenFileDialog{Filter="Frosty mods (*.fbmod)|*.fbmod",Multiselect=true,CheckFileExists=true})if(d.ShowDialog(this)==DialogResult.OK){foreach(string file in d.FileNames)AddChoice(new HeatModChoice{SourcePath=Path.GetFullPath(file),DisplayName=Path.GetFileNameWithoutExtension(file),Enabled=true});SaveState();}}
    private void AddChoice(HeatModChoice choice){foreach(HeatModChoice old in mods.Items)if(String.Equals(old.SourcePath,choice.SourcePath,StringComparison.OrdinalIgnoreCase)&&String.Equals(old.PackEntry,choice.PackEntry,StringComparison.OrdinalIgnoreCase))return;mods.Items.Add(choice,choice.Enabled);}
    private void RemoveMod(object sender,EventArgs e){if(mods.SelectedIndex>=0){mods.Items.RemoveAt(mods.SelectedIndex);SaveState();}}
    private void MoveUp(object sender,EventArgs e){MoveSelected(-1);}private void MoveDown(object sender,EventArgs e){MoveSelected(1);}
    private void MoveSelected(int delta){int from=mods.SelectedIndex,to=from+delta;if(from<0||to<0||to>=mods.Items.Count)return;var item=(HeatModChoice)mods.Items[from];bool check=mods.GetItemChecked(from);changingChecks=true;mods.Items.RemoveAt(from);mods.Items.Insert(to,item);mods.SetItemChecked(to,check);changingChecks=false;mods.SelectedIndex=to;SaveState();}
    public void SelectSoundtrack(string file){if(File.Exists(file)){soundtrackPath=Path.GetFullPath(file);UpdateSoundtrack();SaveState();}}
    private void UpdateSoundtrack(){soundtrack.Text=String.IsNullOrEmpty(soundtrackPath)?"SOUNDTRACK: build or select a soundtrack first":"SOUNDTRACK (APPLIED LAST): "+Path.GetFileName(soundtrackPath);}
    public void CancelSafely(){try{if(running!=null&&!running.HasExited&&!String.IsNullOrEmpty(cancelPath))File.WriteAllText(cancelPath,"Cancel requested at "+DateTime.UtcNow.ToString("O"),new UTF8Encoding(false));}catch{} }

    private void HandleItemCheck(object sender,ItemCheckEventArgs e)
    {
        if(changingChecks)return;var item=(HeatModChoice)mods.Items[e.Index];item.Enabled=e.NewValue==CheckState.Checked;
        if(item.Enabled&&item.IsPackComponent){string group=ConflictGroup(item.DisplayName);if(group!=null){changingChecks=true;for(int i=0;i<mods.Items.Count;i++){var other=(HeatModChoice)mods.Items[i];if(i!=e.Index&&String.Equals(other.SourcePath,item.SourcePath,StringComparison.OrdinalIgnoreCase)&&ConflictGroup(other.DisplayName)==group){other.Enabled=false;mods.SetItemChecked(i,false);}}changingChecks=false;}}
        BeginInvoke(new Action(SaveState));
    }
    private static string ConflictGroup(string name){if(name.IndexOf("Handling Overhaul",StringComparison.OrdinalIgnoreCase)>=0)return "handling";if(name.IndexOf("Stance",StringComparison.OrdinalIgnoreCase)>=0)return "stance";return null;}

    private void ApplyAndLaunch()
    {
        if(Busy)return;string game=gameFolder();string exe=Path.Combine(game,"NeedForSpeedHeat.exe");
        if(!File.Exists(exe)){MessageBox.Show(this,"Select the NFS Heat game folder first.");return;}
        if(String.IsNullOrEmpty(soundtrackPath)||!File.Exists(soundtrackPath)){MessageBox.Show(this,"Build a soundtrack FBMOD first.");return;}
        string cli=ResolveRuntime("HEAT_MUSIC_FROSTY_GPL",Path.Combine("frosty-gpl","FrostyCli.dll"));
        string dotnet=ResolveRuntime("HEAT_MUSIC_DOTNET",Path.Combine("dotnet8","dotnet.exe"),Path.Combine("dotnet","dotnet.exe"));
        string key=ResolveRuntime("HEAT_MUSIC_INITFS_KEY",Path.Combine("FrostyEditor","NFSHEAT.key"),Path.Combine("keys","NFSHEAT.key"));
        string script=Path.Combine(workspace,"work","FrostyGplManager.js");
        foreach(string required in new[]{node,cli,dotnet,key,script})if(!File.Exists(required)){MessageBox.Show(this,"V5 runtime component is missing:\n"+required);return;}
        var selected=new List<string>();string extraction=Path.Combine(workspace,"output","fbpack-cache");
        try{for(int i=0;i<mods.Items.Count;i++)if(mods.GetItemChecked(i))selected.Add(HeatFbPack.Extract((HeatModChoice)mods.Items[i],extraction));}
        catch(Exception ex){MessageBox.Show(this,"Could not prepare FBPACK: "+ex.Message);return;}
        string session=Path.Combine(workspace,"output","frosty-v5-session");Directory.CreateDirectory(session);
        string modData=Path.Combine(game,"ModData","HeatMusicV5");string config=Path.Combine(session,"manager-config.json");cancelPath=config+".cancel";if(File.Exists(cancelPath))File.Delete(cancelPath);
        var data=new Dictionary<string,object>{{"gameExe",exe},{"frostyCli",cli},{"dotnet",dotnet},{"initFsKey",key},
            {"workDir",Path.Combine(session,"work")},{"cacheDir",Path.Combine(workspace,"output","frosty-v5-cache")},{"cancelFile",cancelPath},{"modDataDir",modData},{"mods",selected.ToArray()},{"musicMod",soundtrackPath}};
        File.WriteAllText(config,new JavaScriptSerializer().Serialize(data),new UTF8Encoding(false));
        launch.Enabled=false;log.Clear();Append("Preparing combined Frosty profile...");
        running=new Process{StartInfo=new ProcessStartInfo{FileName=node,Arguments="\""+script+"\" \""+config+"\"",WorkingDirectory=workspace,
            UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8},EnableRaisingEvents=true};
        var process=running;process.OutputDataReceived+=(s,a)=>{if(a.Data!=null)Append(a.Data);};process.ErrorDataReceived+=(s,a)=>{if(a.Data!=null)Append("ERROR "+a.Data);};
        process.Exited+=(s,a)=>{process.WaitForExit();int code=process.ExitCode;BeginInvoke(new Action(()=>{running=null;launch.Enabled=true;process.Dispose();
            if(code==0){notify("Mods ready","Launching NFS Heat with the combined profile.",false);try{HeatGameLauncher.Launch(game,"ModData/HeatMusicV5",Path.Combine(workspace,"runtime"),Append);}catch(Exception ex){MessageBox.Show(this,"Profile ready, but launch failed: "+ex.Message);}}
            else if(code==2)notify("Launch cancelled","The active profile was preserved.",false);else notify("Frosty apply failed","Open the manager log for details.",true);cancelPath=null;if(Finished!=null)Finished();}));};
        try{process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();}catch(Exception ex){running=null;launch.Enabled=true;process.Dispose();MessageBox.Show(this,ex.Message);}
    }
    private sealed class SavedState{public string soundtrack{get;set;}public List<HeatModChoice> mods{get;set;}}
    private string ResolveRuntime(string environment,params string[] candidates){string configured=Environment.GetEnvironmentVariable(environment);if(!String.IsNullOrWhiteSpace(configured)&&File.Exists(configured))return Path.GetFullPath(configured);foreach(string candidate in candidates){string full=Path.Combine(workspace,"runtime",candidate);if(File.Exists(full))return full;}return Path.Combine(workspace,"runtime",candidates[0]);}
    private void LoadState(){try{if(!File.Exists(StatePath))return;var state=new JavaScriptSerializer().Deserialize<SavedState>(File.ReadAllText(StatePath));if(state==null)return;soundtrackPath=state.soundtrack;changingChecks=true;if(state.mods!=null)foreach(var item in state.mods)if(File.Exists(item.SourcePath))AddChoice(item);changingChecks=false;UpdateSoundtrack();}catch(Exception ex){changingChecks=false;Append("STATE WARNING "+ex.Message);}}
    private void SaveState(){try{Directory.CreateDirectory(Path.GetDirectoryName(StatePath));var items=new List<HeatModChoice>();for(int i=0;i<mods.Items.Count;i++){var item=(HeatModChoice)mods.Items[i];item.Enabled=mods.GetItemChecked(i);items.Add(item);}File.WriteAllText(StatePath,new JavaScriptSerializer().Serialize(new SavedState{soundtrack=soundtrackPath,mods=items}),new UTF8Encoding(false));}catch(Exception ex){Append("STATE WARNING "+ex.Message);}}
    private void Append(string text){if(InvokeRequired){BeginInvoke(new Action<string>(Append),text);return;}log.AppendText(text+Environment.NewLine);}
}
