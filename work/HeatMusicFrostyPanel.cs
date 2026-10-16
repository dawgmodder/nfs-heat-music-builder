using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class HeatMusicFrostyPanel : UserControl
{
    private readonly string workspace,node;
    private readonly Func<string> game;
    private readonly Func<bool> otherBusy;
    private readonly Action<string,string,bool> notify;
    private readonly TextBox bundle=new TextBox(),profile=new TextBox(),log=new TextBox();
    private readonly Button finish=new Button(),launch=new Button();
    private string target,cancelFile,logFile;
    public bool Busy{get;private set;}
    public event Action Finished;
    public void SelectBundle(string file){bundle.Text=file;}
    public void CancelSafely(){if(Busy&&!String.IsNullOrEmpty(cancelFile)){File.WriteAllText(cancelFile,"Cancel requested");Append("Cancellation requested. Waiting for a safe checkpoint; no processes will be killed.");}}
    public HeatMusicFrostyPanel(string workspace,string node,Func<string> game,Func<bool> otherBusy,Action<string,string,bool> notify)
    {
        this.workspace=workspace;this.node=node;this.game=game;this.otherBusy=otherBusy;this.notify=notify;
        Dock=DockStyle.Fill;BackColor=HeatVisualTheme.Asphalt;ForeColor=HeatVisualTheme.Text;
        var layout=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=7,Padding=new Padding(28)};
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,180));
        foreach(int h in new[]{44,132,50,50,56,32})layout.RowStyles.Add(new RowStyle(SizeType.Absolute,h));layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        var title=new Label{Text="Legacy Frosty export",Dock=DockStyle.Fill,Font=HeatVisualTheme.Ui(22,FontStyle.Bold)};
        layout.Controls.Add(title,0,0);layout.SetColumnSpan(title,2);
        var instructions=new Label{Dock=DockStyle.Fill,ForeColor=HeatVisualTheme.Muted,Text="1. Import the exported FBMOD into official Frosty Mod Manager. Apply your other mods, then this soundtrack LAST.\n2. Click Launch in Frosty to generate the selected profile. If the game opens, close it without playing.\n3. Select soundtrack.heatmusic from the exported .music folder and the Frosty ModData profile folder.\n4. Finalize, then launch below. Repeat finalization whenever the Frosty mod selection changes.\nFrosty, its profile and the original game files remain unchanged. A separate combined profile is created."};
        layout.Controls.Add(instructions,0,1);layout.SetColumnSpan(instructions,2);
        foreach(var t in new[]{bundle,profile}){t.Dock=DockStyle.Fill;t.ReadOnly=true;t.BackColor=HeatVisualTheme.Void;t.ForeColor=HeatVisualTheme.Text;t.Margin=new Padding(0,9,10,9);}
        var chooseBundle=new Button{Text="Select soundtrack FILE",Dock=DockStyle.Fill};HeatVisualTheme.StyleButton(chooseBundle);
        chooseBundle.Click+=(s,e)=>{if(Busy)return;using(var d=new OpenFileDialog{Filter="Soundtrack companion (*.heatmusic)|*.heatmusic",InitialDirectory=Path.Combine(workspace,"output","exports")})if(d.ShowDialog(this)==DialogResult.OK)bundle.Text=d.FileName;};
        var chooseProfile=new Button{Text="Select Frosty FOLDER",Dock=DockStyle.Fill};HeatVisualTheme.StyleButton(chooseProfile);
        chooseProfile.Click+=(s,e)=>{if(Busy)return;using(var d=new FolderBrowserDialog{Description="Select the profile Frosty generated, e.g. NFS Heat / ModData / custom (not ModData itself)",SelectedPath=Path.Combine(game(),"ModData")})if(d.ShowDialog(this)==DialogResult.OK)profile.Text=d.SelectedPath;};
        layout.Controls.Add(bundle,0,2);layout.Controls.Add(chooseBundle,1,2);layout.Controls.Add(profile,0,3);layout.Controls.Add(chooseProfile,1,3);
        finish.Text="FINALIZE AND VERIFY";launch.Text="START COMBINED GAME";finish.Dock=launch.Dock=DockStyle.Fill;launch.Enabled=false;
        HeatVisualTheme.StyleButton(finish,true);HeatVisualTheme.StyleButton(launch);finish.Click+=async(s,e)=>await Run(false);launch.Click+=async(s,e)=>await Run(true);
        layout.Controls.Add(finish,0,4);layout.Controls.Add(launch,1,4);
        layout.Controls.Add(new Label{Text="No audio reconversion • 199 payload checks • Other mod files preserved",Dock=DockStyle.Fill,ForeColor=HeatVisualTheme.Muted},0,5);layout.SetColumnSpan(layout.GetControlFromPosition(0,5),2);
        log.Dock=DockStyle.Fill;log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;log.BackColor=HeatVisualTheme.Void;log.ForeColor=HeatVisualTheme.Text;log.Font=new Font("Consolas",9);layout.Controls.Add(log,0,6);layout.SetColumnSpan(log,2);Controls.Add(layout);
        try{string saved=Path.Combine(workspace,"output","frosty-last.json");if(File.Exists(saved)){var state=new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string,string>>(File.ReadAllText(saved));bundle.Text=state["bundle"];profile.Text=state["profile"];target=state["target"];launch.Enabled=Directory.Exists(target);Append("Previous combined profile restored. It will be verified again before launch.");}}catch{target=null;launch.Enabled=false;}
    }
    private void Append(string text){if(InvokeRequired){BeginInvoke(new Action<string>(Append),text);return;}log.AppendText(text+Environment.NewLine);if(logFile!=null)try{File.AppendAllText(logFile,text+Environment.NewLine,Encoding.UTF8);}catch{}}
    private async Task Run(bool start)
    {
        if(Busy||otherBusy()){MessageBox.Show(this,"Wait for the current operation to finish.");return;}
        if(!start&&(!File.Exists(bundle.Text)||!Directory.Exists(profile.Text))){MessageBox.Show(this,"Select the soundtrack file and Frosty profile folder first.");return;}
        string selectedGame=Path.GetFullPath(game()),selectedTarget=target;
        var dir=Path.Combine(workspace,"output","installer-logs");Directory.CreateDirectory(dir);logFile=Path.Combine(dir,"v4-3-finalize-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff")+".log");cancelFile=logFile+".cancel";
        var config=start?(object)new{mode="validate-launch",game=selectedGame,target=selectedTarget}:new{game=selectedGame,profile=profile.Text,bundle=bundle.Text};
        string configFile=logFile+".json";File.WriteAllText(configFile,new JavaScriptSerializer().Serialize(config),new UTF8Encoding(false));
        Busy=true;finish.Enabled=launch.Enabled=false;Append("LOG "+logFile);
        if(!start)target=null;
        try{
            int code=await Task.Run(()=>{using(var p=new Process()){
                p.StartInfo=new ProcessStartInfo{FileName=node,Arguments="\""+Path.Combine(workspace,"work","HeatMusicFrostyCompanion.js")+"\" \""+configFile+"\"",WorkingDirectory=workspace,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8};
                p.StartInfo.EnvironmentVariables["HEAT_MUSIC_CANCEL_FILE"]=cancelFile;
                p.OutputDataReceived+=(s,e)=>{if(e.Data!=null){if(e.Data.StartsWith("COMBINED_READY "))target=e.Data.Substring(15);Append(e.Data);}};
                p.ErrorDataReceived+=(s,e)=>{if(e.Data!=null)Append(e.Data);};p.Start();p.BeginOutputReadLine();p.BeginErrorReadLine();p.WaitForExit();return p.ExitCode;}});
            if(code!=0)throw new InvalidOperationException("Finalization/verification failed. Read the log above. Existing profiles were not modified.");
            if(start&&!File.Exists(cancelFile)){
                string id=Path.GetFileName(selectedTarget);
                if(selectedGame.IndexOf("steamapps",StringComparison.OrdinalIgnoreCase)>=0)Process.Start(new ProcessStartInfo{FileName="steam://run/1222680//"+Uri.EscapeDataString("-dataPath \"ModData/"+id+"\"")+"/",UseShellExecute=true});
                else Process.Start(new ProcessStartInfo{FileName=Path.Combine(selectedGame,"NeedForSpeedHeat.exe"),Arguments="-dataPath \"ModData/"+id+"\"",WorkingDirectory=selectedGame,UseShellExecute=true});
                Append("Game launch requested. Remove conflicting launch options from Steam/EA App.");
            }else if(!start){Append("Ready: "+target);try{File.WriteAllText(Path.Combine(workspace,"output","frosty-last.json"),new JavaScriptSerializer().Serialize(new{bundle=bundle.Text,profile=profile.Text,target=target}),new UTF8Encoding(false));}catch(Exception saveError){Append("Could not save last profile: "+saveError.Message);}notify("Combined profile ready","All 199 audio payloads verified. Use Start combined game.",false);}
        }catch(Exception ex){Append(ex.Message);notify("Finalization not completed",ex.Message,true);}
        finally{Busy=false;finish.Enabled=true;launch.Enabled=!String.IsNullOrEmpty(target)&&Directory.Exists(target);if(Finished!=null)Finished();}
    }
}
