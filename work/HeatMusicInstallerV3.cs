using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

internal sealed class HeatMusicInstallerV3 : Form
{
    private readonly TextBox folder = new TextBox();
    private readonly TextBox gameFolder = new TextBox();
    private readonly TextBox log = new TextBox();
    private readonly Button analyze = new Button();
    private readonly Button install = new Button();
    private readonly Button openExports = new Button();
    private readonly Button savePreset=new Button(),loadPreset=new Button();
        private readonly TabControl tabs = new HeatNavigationTabs();
    private readonly HeatMusicPlanEditor editor;
    private readonly HeatMusicModManagerPanel frostyPanel;
    private readonly string workspace,script,node;
    private readonly bool portable;
    private string lastReportJson,runLogPath,cancelPath;
    private Process running;
    private bool closeRequested;
    private bool presetBusy;
    private readonly NotifyIcon notifier=new NotifyIcon();
    private readonly Label activity=new Label{Text="Ready — choose your music or import a preset",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft,ForeColor=HeatVisualTheme.Text};
    private readonly ProgressBar progress=new ProgressBar{Dock=DockStyle.Bottom,Height=3,Style=ProgressBarStyle.Marquee,Visible=false};
    private readonly CheckBox notifications=new CheckBox{Text="Desktop notifications",Checked=true,AutoSize=true,ForeColor=HeatVisualTheme.Muted,Dock=DockStyle.Right};
    private void Status(string text,bool busy){activity.Text=text;progress.Visible=busy;}
    private void Notify(string title,string message,bool error=false){
        Status(title+" — "+message,false);
        if(notifications.Checked&&!closeRequested){notifier.Visible=true;notifier.ShowBalloonTip(7000,title,message,error?ToolTipIcon.Error:ToolTipIcon.Info);}
    }

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new HeatMusicInstallerV3());
    }

    private HeatMusicInstallerV3()
    {
        string executableDirectory=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        workspace=Directory.Exists(Path.Combine(executableDirectory,"work"))?
            executableDirectory:Directory.GetParent(executableDirectory).FullName;
        portable=File.Exists(Path.Combine(workspace,"runtime","node.exe"));
        if(portable)Environment.SetEnvironmentVariable("HEAT_MUSIC_FFMPEG",Path.Combine(workspace,"runtime","tools","ffmpeg.exe"));
        editor=new HeatMusicPlanEditor();
        script=Path.Combine(workspace,"work",portable?"HeatMusicPortableEntry.js":"HeatMusicAutoPlanner.js");
        node=portable?Path.Combine(workspace,"runtime","node.exe"):@"C:\Program Files\nodejs\node.exe";
        Text="NFS Heat — Music Builder V5 Beta 7.3";
        Icon=HeatMusicBrand.CreateIcon();notifier.Icon=Icon;notifier.Text="Heat Music Builder V5 Beta 7.3";
        notifier.BalloonTipClicked+=(s,e)=>{Show();WindowState=FormWindowState.Normal;Activate();};
        notifier.DoubleClick+=(s,e)=>{Show();WindowState=FormWindowState.Normal;Activate();};
        Width=1180;Height=850;MinimumSize=new Size(1060,760);
        StartPosition=FormStartPosition.CenterScreen;
        BackColor=HeatVisualTheme.Void;ForeColor=HeatVisualTheme.Text;Font=HeatVisualTheme.Ui(10);
        var panel=new HeatSurfacePanel{Dock=DockStyle.Fill,ColumnCount=3,RowCount=7,
            Padding=new Padding(20,16,20,18)};
        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,220));
        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,170));
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute,52));
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute,52));
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute,70));
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute,54));
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute,60));
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute,54));
        panel.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        tabs.Dock=DockStyle.Fill;HeatVisualTheme.StyleTabs(tabs);
        var installTab=new TabPage("Build mod"){BackColor=HeatVisualTheme.Asphalt,Padding=new Padding(0)};
        var editTab=new TabPage("Configure music"){BackColor=HeatVisualTheme.Asphalt,Padding=new Padding(0)};
        installTab.Controls.Add(panel);editTab.Controls.Add(editor);
        var presetBar=new FlowLayoutPanel{Dock=DockStyle.Top,Height=58,Padding=new Padding(24,12,0,8),WrapContents=false,BackColor=HeatVisualTheme.Panel};
        savePreset.Text="EXPORT PRESET";loadPreset.Text="IMPORT PRESET";
        foreach(var button in new[]{savePreset,loadPreset}){button.Width=180;button.Height=32;HeatVisualTheme.StyleButton(button);presetBar.Controls.Add(button);}
        savePreset.Enabled=false;
        savePreset.Click+=(s,e)=>ExportPreset();loadPreset.Click+=(s,e)=>ImportPreset();
        presetBar.Controls.Add(new Label{Text="Music, settings and available conversions",AutoSize=true,Margin=new Padding(10,9,0,0)});
        editTab.Controls.Add(presetBar);
        tabs.TabPages.Add(installTab);tabs.TabPages.Add(editTab);
        frostyPanel=new HeatMusicModManagerPanel(workspace,node,()=>gameFolder.Text.Trim(),Notify);
        frostyPanel.Finished+=()=>{if(closeRequested)Close();};
        var frostyTab=new TabPage("Mods & Launch"){BackColor=HeatVisualTheme.Asphalt};frostyTab.Controls.Add(frostyPanel);tabs.TabPages.Add(frostyTab);
        var shell=new Panel{Dock=DockStyle.Fill,BackColor=HeatVisualTheme.Void};
        var statusBar=new Panel{Dock=DockStyle.Bottom,Height=46,Padding=new Padding(20,8,20,8),BackColor=HeatVisualTheme.Panel};
        statusBar.Controls.Add(activity);statusBar.Controls.Add(notifications);statusBar.Controls.Add(progress);
        var navigation=new FlowLayoutPanel{Dock=DockStyle.Top,Height=52,Padding=new Padding(24,6,0,6),BackColor=HeatVisualTheme.Panel,WrapContents=false};
        var navInstall=new Button{Text="BUILD MOD",Width=160,Height=38};
        var navLibrary=new Button{Text="CONFIGURE MUSIC",Width=210,Height=38};
        HeatVisualTheme.StyleButton(navInstall);HeatVisualTheme.StyleButton(navLibrary);
        navInstall.Click+=(s,e)=>tabs.SelectedIndex=0;navLibrary.Click+=(s,e)=>tabs.SelectedIndex=1;
        Action updateNavigation=()=>{navInstall.BackColor=tabs.SelectedIndex==0?HeatVisualTheme.PanelRaised:HeatVisualTheme.Panel;
            navInstall.ForeColor=tabs.SelectedIndex==0?HeatVisualTheme.ElectricBlue:HeatVisualTheme.Muted;
            navLibrary.ForeColor=tabs.SelectedIndex==1?HeatVisualTheme.ElectricBlue:HeatVisualTheme.Muted;
            navLibrary.BackColor=tabs.SelectedIndex==1?HeatVisualTheme.PanelRaised:HeatVisualTheme.Panel;
            navInstall.FlatAppearance.BorderColor=tabs.SelectedIndex==0?HeatVisualTheme.ElectricRose:HeatVisualTheme.Grid;
            navLibrary.FlatAppearance.BorderColor=tabs.SelectedIndex==1?HeatVisualTheme.ElectricRose:HeatVisualTheme.Grid;};
        tabs.SelectedIndexChanged+=(s,e)=>updateNavigation();updateNavigation();
        Shown+=(s,e)=>updateNavigation();
        navigation.Controls.Add(navInstall);navigation.Controls.Add(navLibrary);
        var navFrosty=new Button{Text="MODS & LAUNCH",Width=180,Height=38};HeatVisualTheme.StyleButton(navFrosty);navFrosty.Click+=(s,e)=>tabs.SelectedIndex=2;navigation.Controls.Add(navFrosty);
        shell.Controls.Add(tabs);shell.Controls.Add(statusBar);shell.Controls.Add(navigation);shell.Controls.Add(new HeatHeaderPanel());Controls.Add(shell);
        var gameLabel=new Label{Text="NFS Heat folder (Steam/EA App)",Dock=DockStyle.Fill,
            TextAlign=ContentAlignment.MiddleLeft};
        gameFolder.Dock=DockStyle.Fill;gameFolder.Margin=new Padding(0,9,8,9);
        gameFolder.BackColor=HeatVisualTheme.Void;gameFolder.ForeColor=HeatVisualTheme.Text;
        gameFolder.BorderStyle=BorderStyle.FixedSingle;
        string steamPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            "Steam","steamapps","common","Need for Speed Heat");
        string eaPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "EA Games","Need for Speed Heat");
        gameFolder.Text=Directory.Exists(steamPath)?steamPath:Directory.Exists(eaPath)?eaPath:steamPath;
        var selectGame=new Button{Text="Select game...",Dock=DockStyle.Fill,Margin=new Padding(0,4,0,4)};
        HeatVisualTheme.StyleButton(selectGame);
        selectGame.Click+=(s,e)=>{using(var dialog=new FolderBrowserDialog{
            Description="Select the folder containing NeedForSpeedHeat.exe",
            SelectedPath=Directory.Exists(gameFolder.Text)?gameFolder.Text:Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)})
            if(dialog.ShowDialog(this)==DialogResult.OK)gameFolder.Text=dialog.SelectedPath;};
        panel.Controls.Add(gameLabel,0,0);panel.Controls.Add(gameFolder,1,0);panel.Controls.Add(selectGame,2,0);
        var label=new Label{Text="Folder containing ALL music",Dock=DockStyle.Fill,
            TextAlign=ContentAlignment.MiddleLeft};
        folder.Dock=DockStyle.Fill;folder.Margin=new Padding(0,9,8,9);
        folder.BackColor=HeatVisualTheme.Void;folder.ForeColor=HeatVisualTheme.Text;
        folder.BorderStyle=BorderStyle.FixedSingle;
        folder.Text=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            "Downloads","Soundtrack","Original");
        var select=new Button{Text="Select folder...",Dock=DockStyle.Fill,Margin=new Padding(0,4,0,4)};
        HeatVisualTheme.StyleButton(select);
        select.Click+=(s,e)=>{using(var dialog=new FolderBrowserDialog{
            Description="Select ONE folder containing all your music",
            SelectedPath=Directory.Exists(folder.Text)?folder.Text:Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)})
            if(dialog.ShowDialog(this)==DialogResult.OK)folder.Text=dialog.SelectedPath;};
        panel.Controls.Add(label,0,1);panel.Controls.Add(folder,1,1);panel.Controls.Add(select,2,1);
        var explanation=new Label{Text="Analyze a folder or import a preset in the Configure music tab. Presets include music, playlists and drops, so no new analysis is needed. In the lobby, the intro plays once and the loop continues after it.",
            Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft,ForeColor=HeatVisualTheme.Muted};
        panel.Controls.Add(explanation,0,2);panel.SetColumnSpan(explanation,3);
        analyze.Text="ANALYZE AND CONFIGURE";analyze.Dock=DockStyle.Fill;HeatVisualTheme.StyleButton(analyze);
        analyze.Click+=(s,e)=>Run(true);
        install.Text="BUILD AND EXPORT MOD";install.Dock=DockStyle.Fill;install.Enabled=false;
        HeatVisualTheme.StyleButton(install,true);install.Click+=(s,e)=>Run(false);
        panel.Controls.Add(analyze,1,3);panel.Controls.Add(install,1,4);
        var note=new Label{Text="The game playlists support up to 59 distinct tracks. The report lists any extras left out. The game chooses race intros and may repeat a track. Analysis and conversion can take a while.",
            Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft,ForeColor=HeatVisualTheme.Muted};
        panel.Controls.Add(note,0,3);panel.SetRowSpan(note,2);
        panel.Controls.Add(new Label{Text="The builder exports an FBMOD for Frosty Mod Manager; it does not install or launch the game.",
            Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft,ForeColor=HeatVisualTheme.Muted},2,4);
        log.Multiline=true;log.ScrollBars=ScrollBars.Vertical;log.ReadOnly=true;
        log.Dock=DockStyle.Fill;log.BackColor=HeatVisualTheme.Void;log.ForeColor=Color.FromArgb(213,226,232);
        log.BorderStyle=BorderStyle.FixedSingle;
        log.Font=new Font("Consolas",9);panel.Controls.Add(log,0,6);panel.SetColumnSpan(log,3);
        // Recompose existing controls; processing handlers and input semantics remain unchanged.
        panel.Controls.Clear();panel.RowStyles.Clear();panel.ColumnStyles.Clear();
        panel.Padding=new Padding(28,20,28,20);panel.RowCount=7;
        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,190));
        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,168));
        foreach(int height in new[]{86,64,64,78,34,30})panel.RowStyles.Add(new RowStyle(SizeType.Absolute,height));
        panel.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        var hero=new Panel{Dock=DockStyle.Fill};
        hero.Controls.Add(new Label{Text="Your soundtrack. Your streets.",Dock=DockStyle.Top,Height=40,Font=HeatVisualTheme.Ui(22,FontStyle.Bold)});
        hero.Controls.Add(new Label{Text="Choose your library, refine your playlists, then build your soundtrack.",Dock=DockStyle.Bottom,Height=32,ForeColor=HeatVisualTheme.Muted});
        panel.Controls.Add(hero,0,0);panel.SetColumnSpan(hero,3);
        gameLabel.Text="01   GAME LOCATION";label.Text="02   MUSIC LIBRARY";
        gameLabel.Font=label.Font=HeatVisualTheme.Ui(9,FontStyle.Bold);
        selectGame.Text="Browse game";select.Text="Browse music";
        panel.Controls.Add(gameLabel,0,1);panel.Controls.Add(gameFolder,1,1);panel.Controls.Add(selectGame,2,1);
        panel.Controls.Add(label,0,2);panel.Controls.Add(folder,1,2);panel.Controls.Add(select,2,2);
        var actions=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,Padding=new Padding(0,12,0,8),Margin=new Padding(0)};
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
        analyze.Text="ANALYZE LIBRARY";install.Text="BUILD AND EXPORT MOD";
        analyze.Margin=new Padding(0,0,12,0);install.Margin=new Padding(0);
        actions.Controls.Add(analyze,0,0);actions.Controls.Add(install,1,0);
        panel.Controls.Add(actions,0,3);panel.SetColumnSpan(actions,3);
        var safety=new Label{Text="Build one soundtrack FBMOD, then combine it with an FBPACK or individual mods under MODS & LAUNCH.",Dock=DockStyle.Fill,ForeColor=HeatVisualTheme.Muted,Font=HeatVisualTheme.Ui(9)};
        openExports.Text="OPEN EXPORT FOLDER";openExports.Dock=DockStyle.Fill;
        openExports.Enabled=Directory.Exists(Path.Combine(workspace,"output","exports"));
        HeatVisualTheme.StyleButton(openExports);
        openExports.Click+=(s,e)=>OpenExportFolder();
        panel.Controls.Add(safety,0,4);panel.SetColumnSpan(safety,2);
        panel.Controls.Add(openExports,2,4);
        panel.Controls.Add(new Label{Text="ACTIVITY LOG",Dock=DockStyle.Fill,ForeColor=HeatVisualTheme.Muted,Font=HeatVisualTheme.Ui(9,FontStyle.Bold)},0,5);
        log.BorderStyle=BorderStyle.None;log.Margin=Padding.Empty;
        panel.Controls.Add(log,0,6);panel.SetColumnSpan(log,3);
        Append("V5 Beta 7.3: lower mods in the list override upper mods; soundtrack has highest priority. Default Garage is an optional UNITE addon, not required or included. Profile files are validated before and after publication. Compatible converted audio is reused. Profile: HeatMusicV5Beta7_3. Logs: output/frosty-v5-session/logs.");
        FormClosing+=HandleFormClosing;
        Append("DURATION: no maximum track length is imposed. Long tracks remain subject to converter, file-size and integrity checks.");
        FormClosed+=(s,e)=>{notifier.Visible=false;notifier.Dispose();editor.Dispose();};
    }

    private void HandleFormClosing(object sender,FormClosingEventArgs e)
    {
        if(frostyPanel.Busy){e.Cancel=true;if(!closeRequested&&MessageBox.Show(this,"Cancel at the next safe checkpoint and close? Existing game and Frosty profiles remain unchanged.","Close safely",MessageBoxButtons.YesNo)==DialogResult.Yes){frostyPanel.CancelSafely();closeRequested=true;}return;}
        if(presetBusy){e.Cancel=true;closeRequested=true;Append("Waiting for preset import/export to finish before closing safely.");return;}
        if(running==null)return;
        bool active;
        try{active=!running.HasExited;}catch(InvalidOperationException){active=false;}
        if(!active)return;
        e.Cancel=true;
        if(closeRequested)return;
        var answer=MessageBox.Show(this,
            "The builder is still working. Request cancellation and close after all processes finish? An active audio conversion will finish safely first.",
            "Close safely",MessageBoxButtons.YesNo,MessageBoxIcon.Question);
        if(answer!=DialogResult.Yes)return;
        try{File.WriteAllText(cancelPath,"Cancellation requested at "+DateTime.Now.ToString("O"),new UTF8Encoding(false));}
        catch(Exception ex){MessageBox.Show(this,"Could not request cancellation: "+ex.Message);return;}
        closeRequested=true;
        analyze.Enabled=false;install.Enabled=false;
        Append("CANCELLATION_REQUESTED: the window will stay open until the main process and its children finish.");
    }

    private void Append(string message)
    {
        if(InvokeRequired){BeginInvoke(new Action<string>(Append),message);return;}
        log.AppendText(message+Environment.NewLine);
        if(running!=null){
            if(message.StartsWith("NORMALIZED")||message.StartsWith("REUSED_NORMALIZED"))Status("Processing audio — normalization / cache",true);
            else if(message.StartsWith("ENCODED")||message.StartsWith("RETRY"))Status("Processing audio — encoding and validation",true);
            else if(message.StartsWith("METADATA_BEGIN"))Status("Building game metadata",true);
        }
        if(!String.IsNullOrEmpty(runLogPath)){
            try{File.AppendAllText(runLogPath,message+Environment.NewLine,new UTF8Encoding(false));}
            catch{ /* The on-screen log remains available if disk space runs out. */ }
        }
    }

    private void Run(bool planOnly)
    {
        if(frostyPanel.Busy||running!=null||presetBusy){MessageBox.Show(this,"Wait for the current operation to finish.");return;}
        if(!File.Exists(script)||!File.Exists(node)){MessageBox.Show(this,"Builder engine or Node.js not found.");return;}
        string selected=folder.Text.Trim();
        if(!Directory.Exists(selected)){MessageBox.Show(this,"Select an existing folder containing music.");return;}
        string selectedGame=gameFolder.Text.Trim();
        if(!File.Exists(Path.Combine(selectedGame,"NeedForSpeedHeat.exe"))){
            MessageBox.Show(this,"Select the game folder containing NeedForSpeedHeat.exe.");return;}
        string editedPlan=null;
        if(!planOnly){
            if(!editor.HasPlan||!String.Equals(Path.GetFullPath(editor.SourceDirectory),
                Path.GetFullPath(selected),StringComparison.OrdinalIgnoreCase)){
                MessageBox.Show(this,"Click 'Analyze and configure' for this folder before building the mod.");return;}
            try{editedPlan=editor.Save();}
            catch(Exception ex){tabs.SelectedIndex=1;MessageBox.Show(this,ex.Message,"Invalid plan",
                MessageBoxButtons.OK,MessageBoxIcon.Warning);return;}
        }
        string logDir=Path.Combine(workspace,"output","installer-logs");
        Directory.CreateDirectory(logDir);
        runLogPath=Path.Combine(logDir,"v4-3-"+DateTime.Now.ToString("yyyyMMdd-HHmmss-fff")+".log");
        lastReportJson=planOnly?null:lastReportJson;
        Status(planOnly?"Analyzing your music…":"Building a Frosty mod file…",true);
        cancelPath=runLogPath+".cancel";
        closeRequested=false;
        Append("Full log: "+runLogPath);
        if(!planOnly){
            try{long free=new DriveInfo(Path.GetPathRoot(workspace)).AvailableFreeSpace;
                if(free<6L*1024*1024*1024)
                    Append("WARNING: free space is "+(free/(1024.0*1024*1024)).ToString("F1")+
                        " GB; building the mod may require several GB.");}
            catch{ /* An unavailable drive reading must not block export. */ }
        }
        analyze.Enabled=false;install.Enabled=false;
        editor.Enabled=false;loadPreset.Enabled=false;savePreset.Enabled=false;
        running=new Process();
        var p=running;
        p.StartInfo=new ProcessStartInfo{FileName=node,
            Arguments="\""+script+"\" \""+Path.GetFullPath(selected)+"\""+
                (planOnly?" --edit-plan":" --use-plan \""+editedPlan+"\""),
            WorkingDirectory=workspace,UseShellExecute=false,RedirectStandardOutput=true,
            RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,
            StandardErrorEncoding=Encoding.UTF8,CreateNoWindow=true};
        p.StartInfo.EnvironmentVariables["HEAT_MUSIC_CANCEL_FILE"]=cancelPath;
        p.StartInfo.EnvironmentVariables["HEAT_MUSIC_GAME"]=Path.GetFullPath(selectedGame);
        p.OutputDataReceived+=(s,a)=>{if(a.Data!=null){
            if(a.Data.StartsWith("AUTO_PLAN_JSON ",StringComparison.Ordinal)){
                lastReportJson=a.Data.Substring("AUTO_PLAN_JSON ".Length);}
            if(a.Data.StartsWith("EXPORT_READY ",StringComparison.Ordinal))
                BeginInvoke(new Action(()=>{openExports.Enabled=true;frostyPanel.SelectSoundtrack(a.Data.Substring("EXPORT_READY ".Length));}));
            Append(a.Data);}};
        p.ErrorDataReceived+=(s,a)=>{if(a.Data!=null)Append("ERROR: "+a.Data);};
        p.EnableRaisingEvents=true;
        p.Exited+=(s,a)=>{p.WaitForExit();int code=p.ExitCode;
            BeginInvoke(new Action(()=>{analyze.Enabled=true;install.Enabled=editor.HasPlan;
                editor.Enabled=true;loadPreset.Enabled=true;savePreset.Enabled=editor.HasPlan;
                if(planOnly&&code==0&&!String.IsNullOrEmpty(lastReportJson))OpenEditor();
                Append(closeRequested?"Cancellation completed. No builder processes remain running.":
                    code==0?(planOnly?"Analysis completed. Configure your music in the second tab.":
                    "Soundtrack FBMOD exported. Open MODS & LAUNCH to combine it with your other mods."):
                    "Processing failed (code "+code+"). No new export was produced.");
                running=null;
                if(!closeRequested)Notify(code==0?(planOnly?"Analysis complete":"Mod export complete"):"Processing failed",
                    code==0?(planOnly?"Your playlists are ready to configure.":"Your soundtrack is ready under MODS & LAUNCH."):"Open the activity log for details.",code!=0);
                p.Dispose();
                if(closeRequested)Close();
            }));};
        try{p.Start();p.BeginOutputReadLine();p.BeginErrorReadLine();}
        catch(Exception ex){running=null;analyze.Enabled=true;install.Enabled=editor.HasPlan;
            editor.Enabled=true;loadPreset.Enabled=true;savePreset.Enabled=editor.HasPlan;
            Notify("Could not start",ex.Message,true);p.Dispose();MessageBox.Show(this,ex.Message);}
    }

    private void OpenEditor()
    {
        if(String.IsNullOrEmpty(lastReportJson)||!File.Exists(lastReportJson)){
            MessageBox.Show(this,"Analyze a folder or import a preset first.");return;}
        try{editor.LoadReport(lastReportJson);tabs.SelectedIndex=1;install.Enabled=true;savePreset.Enabled=true;}
        catch(Exception ex){MessageBox.Show(this,"Could not open the plan: "+ex.Message);}
    }

    private void OpenExportFolder()
    {
        string output=Path.Combine(workspace,"output","exports");
        if(!Directory.Exists(output)){MessageBox.Show(this,"No exported mod folder exists yet.");return;}
        try{Process.Start(new ProcessStartInfo{FileName=output,UseShellExecute=true});}
        catch(Exception ex){MessageBox.Show(this,"Could not open the export folder: "+ex.Message);}
    }

    private void PresetBusy(bool active)
    {
        presetBusy=active;analyze.Enabled=!active;install.Enabled=!active&&editor.HasPlan;
        editor.Enabled=!active;savePreset.Enabled=!active&&editor.HasPlan;loadPreset.Enabled=!active;
        if(!active&&closeRequested)Close();
    }
    private async void ExportPreset()
    {
        if(presetBusy||running!=null||frostyPanel.Busy||!editor.HasPlan)return;
        string edited;
        try{edited=editor.Save();}catch(Exception ex){MessageBox.Show(this,ex.Message);return;}
        using(var dialog=new SaveFileDialog{Filter="Preset NFS Heat (*.heatpreset)|*.heatpreset",DefaultExt="heatpreset",
            AddExtension=true,FileName="My-Soundtrack.heatpreset",OverwritePrompt=true}){
            if(dialog.ShowDialog(this)!=DialogResult.OK)return;
            PresetBusy(true);Status("Exporting preset…",true);Append("Exporting preset with music and settings...");
            try{
                string report=lastReportJson,destination=dialog.FileName;
                int converted=await Task.Run(()=>HeatMusicPresetStore.Export(report,edited,destination,Path.Combine(workspace,"output","audio-cache-v1")));
                Append("PRESET_EXPORTED "+destination);
                Notify("Preset exported","Music, settings and available conversions saved.");
                Append("PRESET_CONVERTED_AUDIO "+converted+" available segments (settings not yet built may require new conversions).");
                if(!closeRequested)MessageBox.Show(this,converted==0?
                    "Preset saved, but it has no converted audio yet. Build with this version, then export again to share the conversions.":
                    "Preset saved with "+converted+" converted segments, music and settings. Another computer can reuse compatible segments and build the mod. Settings not yet built may require conversion.");
            }catch(Exception ex){Notify("Preset export failed",ex.Message,true);if(!closeRequested)MessageBox.Show(this,"Could not export: "+ex.Message);}
            finally{PresetBusy(false);}
        }
    }
    private async void ImportPreset()
    {
        if(presetBusy||running!=null||frostyPanel.Busy)return;
        using(var dialog=new OpenFileDialog{Filter="Preset NFS Heat (*.heatpreset)|*.heatpreset",CheckFileExists=true}){
            if(dialog.ShowDialog(this)!=DialogResult.OK)return;
            PresetBusy(true);Status("Importing and validating preset…",true);Append("Importing preset and checking audio integrity...");
            try{
                string source=dialog.FileName,plans=Path.Combine(workspace,"output","auto-plans");
                lastReportJson=await Task.Run(()=>HeatMusicPresetStore.Import(source,plans));
                if(!closeRequested){OpenEditor();folder.Text=editor.SourceDirectory;}
                Append("PRESET_IMPORTED "+lastReportJson);
                Notify("Preset imported","Review your playlists and drops before building.");
                Append("Playlists, drops and available cache restored. Click Build and export mod: compatible conversions will be reused; missing or changed segments will be processed.");
            }catch(Exception ex){Notify("Preset import failed",ex.Message,true);if(!closeRequested)MessageBox.Show(this,"Could not import: "+ex.Message);}
            finally{PresetBusy(false);}
        }
    }
}
