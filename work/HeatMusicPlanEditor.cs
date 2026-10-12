using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class HeatMusicPlanEditor : UserControl
{
    public sealed class Track
    {
        public string file { get; set; }
        public string stagedSource { get; set; }
        public string displayName { get; set; }
        public double duration { get; set; }
        public double dropSeconds { get; set; }
    }
    public sealed class Report
    {
        public string sourceDir { get; set; }
        public Track[] tracks { get; set; }
        public Dictionary<string,string[]> assignments { get; set; }
        public string menu { get; set; }
    }
    public sealed class EditedPlan
    {
        public int version { get; set; }
        public Dictionary<string,List<int>> playlists { get; set; }
        public int menu { get; set; }
        public double[] drops { get; set; }
    }
    private static readonly string[] Keys={"garage","freeDriveDay","freeDriveNight","raceDay","raceNight"};
    private static readonly string[] Names={"Garage","Free roam day","Free roam night","Race day","Race night"};
    private static readonly int[] Capacities={12,10,16,10,11};
    private const decimal MinimumDropSeconds=16.2M;
    private readonly DataGridView grid=new DataGridView();
    private readonly PictureBox wave=new PictureBox();
    private readonly Button play=new Button(),pause=new Button(),stop=new Button(),save=new Button();
    private readonly NumericUpDown drop=new NumericUpDown();
    private readonly Label position=new Label(),message=new Label();
    private readonly Label trackTitle=new Label();
    private readonly Label emptyState=new Label{Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleCenter,ForeColor=HeatVisualTheme.Muted,Text="YOUR LIBRARY STARTS HERE\n\nAnalyze a music folder in Install, or import a preset above.\nThen assign tracks to playlists and fine-tune each drop."};
    private readonly Timer playbackTimer=new Timer();
    private readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=8*1024*1024};
    private readonly string ffmpeg=Environment.GetEnvironmentVariable("HEAT_MUSIC_FFMPEG") ?? @"C:\Program Files\Krita (x64)\bin\ffmpeg.exe";
    private Report report;
    private string reportPath,previewFile;
    private float[] peaks;
    private int selected=-1,generation;
    private bool updating,playing;
    private const string Alias="heatmusicpreview";
    [DllImport("winmm.dll",CharSet=CharSet.Auto)]
    private static extern int mciSendString(string command,StringBuilder result,int length,IntPtr callback);

    public string SourceDirectory { get { return report==null?null:report.sourceDir; } }
    public bool HasPlan { get { return report!=null; } }
    public HeatMusicPlanEditor()
    {
        Dock=DockStyle.Fill;BackColor=HeatVisualTheme.Asphalt;ForeColor=HeatVisualTheme.Text;
        Font=HeatVisualTheme.Ui(10);
        var layout=new TableLayoutPanel{Dock=DockStyle.Fill,RowCount=4,ColumnCount=1,Padding=new Padding(24,8,24,16)};
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,46));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent,60));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent,40));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,38));
        Controls.Add(layout);
        var help=new Label{Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft,
            Text="Mark the actual musical drop (automatic 1 s race-start compensation). Left-click the waveform for the drop; right-click to seek. Older manually compensated presets: move those markers 1 s forward.",
            ForeColor=HeatVisualTheme.Muted,Font=HeatVisualTheme.Ui(9)};
        layout.Controls.Add(help,0,0);
        grid.Dock=DockStyle.Fill;grid.BackgroundColor=Color.FromArgb(12,13,18);
        HeatVisualTheme.StyleGrid(grid);grid.AllowUserToAddRows=false;grid.AllowUserToDeleteRows=false;
        grid.AllowUserToResizeRows=false;grid.MultiSelect=false;grid.RowHeadersVisible=false;
        grid.SelectionMode=DataGridViewSelectionMode.FullRowSelect;
        grid.AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.None;
        grid.Columns.Add(new DataGridViewTextBoxColumn{Name="track",HeaderText="Track",ReadOnly=true,
            AutoSizeMode=DataGridViewAutoSizeColumnMode.Fill,MinimumWidth=210});
        for(int i=0;i<Keys.Length;i++){
            var column=new DataGridViewCheckBoxColumn{Name=Keys[i],HeaderText=Names[i],Width=112};
            column.HeaderCell.ToolTipText=Names[i]+": up to "+Capacities[i]+" tracks";
            grid.Columns.Add(column);
        }
        grid.Columns.Add(new DataGridViewCheckBoxColumn{Name="menu",HeaderText="Menu",Width=64});
        grid.Columns.Add(new DataGridViewTextBoxColumn{Name="drop",HeaderText="Drop (s)",Width=86});
        grid.CurrentCellDirtyStateChanged+=(s,e)=>{if(grid.IsCurrentCellDirty)grid.CommitEdit(DataGridViewDataErrorContexts.Commit);};
        grid.CellValueChanged+=GridChanged;
        grid.SelectionChanged+=(s,e)=>SelectTrack();
        grid.DataError+=(s,e)=>{e.ThrowException=false;};
        layout.Controls.Add(grid,0,1);
        grid.Controls.Add(emptyState);
        var player=new TableLayoutPanel{Dock=DockStyle.Fill,RowCount=3,ColumnCount=1,
            BackColor=HeatVisualTheme.Panel,Padding=new Padding(10)};
        player.RowStyles.Add(new RowStyle(SizeType.Absolute,36));
        player.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        player.RowStyles.Add(new RowStyle(SizeType.Absolute,48));
        trackTitle.Dock=DockStyle.Fill;trackTitle.TextAlign=ContentAlignment.MiddleLeft;
        trackTitle.Text="WAVEFORM  /  SELECT A TRACK";trackTitle.AutoEllipsis=true;
        trackTitle.ForeColor=HeatVisualTheme.Text;trackTitle.Font=HeatVisualTheme.Ui(11,FontStyle.Bold);
        player.Controls.Add(trackTitle,0,0);
        wave.Dock=DockStyle.Fill;wave.BackColor=HeatVisualTheme.Void;
        wave.Paint+=DrawWave;wave.MouseDown+=WaveMouseDown;
        wave.MouseMove+=(s,e)=>{if(e.Button==MouseButtons.Left)SetDropFromX(e.X);};
        player.Controls.Add(wave,0,1);
        var bar=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.LeftToRight,
            WrapContents=false};
        play.Text="Play";pause.Text="Pause";stop.Text="Stop";
        foreach(var button in new[]{play,pause,stop}){button.Width=86;button.Height=32;
            HeatVisualTheme.StyleButton(button);bar.Controls.Add(button);}
        play.Click+=(s,e)=>Play();pause.Click+=(s,e)=>Pause();stop.Click+=(s,e)=>StopAudio();
        bar.Controls.Add(new Label{Text="Drop:",Width=48,Height=30,TextAlign=ContentAlignment.MiddleRight});
        drop.DecimalPlaces=1;drop.Increment=0.1M;drop.Minimum=MinimumDropSeconds;drop.Maximum=150;
        drop.BackColor=HeatVisualTheme.Void;drop.ForeColor=HeatVisualTheme.Text;
        drop.Width=80;drop.ValueChanged+=(s,e)=>DropChanged();bar.Controls.Add(drop);
        position.Width=170;position.Height=30;position.TextAlign=ContentAlignment.MiddleLeft;
        position.Text="00:00 / 00:00";bar.Controls.Add(position);
        player.Controls.Add(bar,0,2);layout.Controls.Add(player,0,2);
        var footer=new FlowLayoutPanel{Dock=DockStyle.Fill,WrapContents=false};
        save.Text="SAVE SETTINGS";save.Width=150;save.Height=30;HeatVisualTheme.StyleButton(save,true);
        save.Click+=(s,e)=>{try{Save();MessageBox.Show(this,"Settings saved. Use 'Build and export mod' in the first tab.");}
            catch(Exception ex){MessageBox.Show(this,ex.Message,"Invalid plan",MessageBoxButtons.OK,MessageBoxIcon.Warning);}};
        footer.Controls.Add(save);
        message.AutoSize=true;message.Text="Analyze a folder or import a preset to begin.";
        message.Margin=new Padding(12,7,0,0);footer.Controls.Add(message);
        layout.Controls.Add(footer,0,3);
        playbackTimer.Interval=150;playbackTimer.Tick+=(s,e)=>UpdatePlayback();
        play.Enabled=pause.Enabled=stop.Enabled=save.Enabled=drop.Enabled=false;
    }
    public void LoadReport(string file)
    {
        if(report!=null&&String.Equals(reportPath,file,StringComparison.OrdinalIgnoreCase))return;
        StopAudio();generation++;peaks=null;previewFile=null;selected=-1;
        report=json.Deserialize<Report>(File.ReadAllText(file,Encoding.UTF8));
        if(report==null||report.tracks==null||report.assignments==null||report.tracks.Length==0)
            throw new InvalidDataException("Invalid music report");
        reportPath=file;
        emptyState.Visible=false;play.Enabled=pause.Enabled=stop.Enabled=save.Enabled=drop.Enabled=true;
        string savedPlan=Path.Combine(Path.GetDirectoryName(file),"editor.json");
        if(File.Exists(savedPlan)){
            var saved=json.Deserialize<EditedPlan>(File.ReadAllText(savedPlan,Encoding.UTF8));
            if(saved!=null&&saved.version==1&&saved.drops!=null&&saved.drops.Length==report.tracks.Length&&
               saved.playlists!=null&&Keys.All(k=>saved.playlists.ContainsKey(k))&&saved.menu>=0&&saved.menu<report.tracks.Length){
                for(int i=0;i<report.tracks.Length;i++)report.tracks[i].dropSeconds=saved.drops[i];
                report.menu=report.tracks[saved.menu].file;
                report.assignments=Keys.ToDictionary(k=>k,k=>saved.playlists[k].Select(i=>report.tracks[i].file).ToArray());
            }
        }
        updating=true;grid.Rows.Clear();
        for(int i=0;i<report.tracks.Length;i++){
            var track=report.tracks[i];
            var values=new object[8];values[0]=track.displayName??Path.GetFileName(track.file);
            for(int k=0;k<Keys.Length;k++)values[k+1]=report.assignments.ContainsKey(Keys[k])&&
                report.assignments[Keys[k]].Contains(track.file,StringComparer.OrdinalIgnoreCase);
            values[6]=String.Equals(report.menu,track.file,StringComparison.OrdinalIgnoreCase);
            values[7]=track.dropSeconds.ToString("0.0",CultureInfo.InvariantCulture);
            grid.Rows.Add(values);
        }
        updating=false;
        UpdateSlotCounters();
        message.Text=report.tracks.Length+" tracks analyzed. Select contexts and save.";
        if(grid.Rows.Count>0){grid.CurrentCell=grid.Rows[0].Cells[0];SelectTrack();}
    }
    private void GridChanged(object sender,DataGridViewCellEventArgs e)
    {
        if(updating||e.RowIndex<0)return;
        if(e.ColumnIndex>=1&&e.ColumnIndex<=5)UpdateSlotCounters();
        if(e.ColumnIndex!=6||!Convert.ToBoolean(grid.Rows[e.RowIndex].Cells[6].Value))return;
        updating=true;
        for(int i=0;i<grid.Rows.Count;i++)if(i!=e.RowIndex)grid.Rows[i].Cells[6].Value=false;
        updating=false;
    }
    private void UpdateSlotCounters()
    {
        for(int k=0;k<Keys.Length;k++){
            int count=0;
            foreach(DataGridViewRow row in grid.Rows)
                if(row.Cells[k+1].Value!=null&&Convert.ToBoolean(row.Cells[k+1].Value))count++;
            int remaining=Capacities[k]-count;
            string state=remaining>=0?remaining+" FREE":(-remaining)+" OVER";
            grid.Columns[k+1].HeaderText=Names[k].ToUpperInvariant()+Environment.NewLine+
                state+"  |  "+count+"/"+Capacities[k];
            grid.Columns[k+1].HeaderCell.Style.ForeColor=count>Capacities[k]?
                HeatVisualTheme.ElectricRose:count==Capacities[k]?HeatVisualTheme.Reward:HeatVisualTheme.Text;
        }
        grid.Invalidate();
    }
    private void SelectTrack()
    {
        if(updating||report==null||grid.CurrentRow==null)return;
        int index=grid.CurrentRow.Index;
        if(index==selected)return;
        StopAudio();selected=index;peaks=null;wave.Invalidate();
        trackTitle.Text=report.tracks[index].displayName??Path.GetFileName(report.tracks[index].file);
        var track=report.tracks[index];
        updating=true;drop.Maximum=(decimal)Math.Min(150,track.duration-8);
        double value;
        if(!Double.TryParse(Convert.ToString(grid.Rows[index].Cells[7].Value),
            NumberStyles.Float,CultureInfo.InvariantCulture,out value))value=track.dropSeconds;
        drop.Value=(decimal)Math.Max((double)MinimumDropSeconds,Math.Min((double)drop.Maximum,value));
        updating=false;
        position.Text="00:00 / "+Time(track.duration);
        message.Text="Preparing player: "+Path.GetFileName(track.file);
        int current=++generation;
        string preview=Path.Combine(Path.GetDirectoryName(reportPath),"preview-"+index+".wav");
        Task.Run(()=>PreparePreview(track.stagedSource,preview)).ContinueWith(task=>{
            if(IsDisposed||!IsHandleCreated)return;
            BeginInvoke(new Action(()=>{
                if(current!=generation)return;
                if(task.IsFaulted){message.Text="Player error: "+task.Exception.GetBaseException().Message;return;}
                previewFile=preview;peaks=task.Result;wave.Invalidate();
                message.Text=Path.GetFileName(track.file)+" — pink: drop; yellow: playback.";
            }));
        });
    }
    private float[] PreparePreview(string source,string preview)
    {
        if(!File.Exists(preview)){
            using(var process=new Process()){
                process.StartInfo=new ProcessStartInfo{FileName=ffmpeg,
                    Arguments="-hide_banner -loglevel error -i \""+source+"\" -vn -ac 1 -ar 8000 -acodec pcm_s16le -y \""+preview+"\"",
                    UseShellExecute=false,CreateNoWindow=true,RedirectStandardError=true};
                process.Start();string error=process.StandardError.ReadToEnd();
                if(!process.WaitForExit(180000)){process.Kill();throw new TimeoutException("Preview conversion timed out");}
                if(process.ExitCode!=0)throw new InvalidDataException(error);
            }
        }
        byte[] data=File.ReadAllBytes(preview);
        int start=-1,size=0;
        for(int at=12;at+8<data.Length;){
            int length=BitConverter.ToInt32(data,at+4);
            if(data[at]==100&&data[at+1]==97&&data[at+2]==116&&data[at+3]==97){start=at+8;size=Math.Min(length,data.Length-start);break;}
            if(length<0)break;at+=8+length+(length&1);
        }
        if(start<0||size<2)throw new InvalidDataException("WAV preview has no audio data");
        var result=new float[1200];int samples=size/2;
        for(int x=0;x<result.Length;x++){
            int from=(int)((long)x*samples/result.Length);
            int to=(int)Math.Min(samples,(long)(x+1)*samples/result.Length);
            int peak=0,step=Math.Max(1,(to-from)/100);
            for(int i=from;i<to;i+=step)peak=Math.Max(peak,Math.Abs((int)BitConverter.ToInt16(data,start+i*2)));
            result[x]=Math.Min(1f,peak/32768f);
        }
        return result;
    }
    private static string Time(double seconds){return TimeSpan.FromSeconds(Math.Max(0,seconds)).ToString(@"mm\:ss");}
    private static int Mci(string command,StringBuilder output=null)
    {return mciSendString(command,output,output==null?0:output.Capacity,IntPtr.Zero);}
    private static int Position()
    {var value=new StringBuilder(32);int ms;return Mci("status "+Alias+" position",value)==0&&
        Int32.TryParse(value.ToString(),out ms)?ms:0;}
    private void Play()
    {
        if(previewFile==null){message.Text="Wait for the preview to load.";return;}
        if(!playing){
            Mci("close "+Alias);
            if(Mci("open \""+previewFile+"\" type waveaudio alias "+Alias)!=0){
                message.Text="Could not open audio in the Windows player.";return;}
            Mci("set "+Alias+" time format milliseconds");
        }
        if(playing&&selected>=0&&Position()/1000.0>=report.tracks[selected].duration-0.2)
            Mci("seek "+Alias+" to 0");
        if(Mci("play "+Alias)==0){playing=true;playbackTimer.Start();}
    }
    private void Pause(){if(playing){Mci("pause "+Alias);playbackTimer.Stop();wave.Invalidate();}}
    private void StopAudio(){playbackTimer.Stop();Mci("stop "+Alias);Mci("close "+Alias);playing=false;wave.Invalidate();}
    private void UpdatePlayback()
    {
        if(selected<0||report==null)return;
        int ms=Position();position.Text=Time(ms/1000.0)+" / "+Time(report.tracks[selected].duration);
        wave.Invalidate();
    }
    private void DropChanged()
    {
        if(updating||selected<0)return;
        grid.Rows[selected].Cells[7].Value=drop.Value.ToString("0.0",CultureInfo.InvariantCulture);
        wave.Invalidate();
    }
    private void WaveMouseDown(object sender,MouseEventArgs e)
    {
        if(selected<0||report==null||wave.Width<=0)return;
        double seconds=Math.Max(0,Math.Min(report.tracks[selected].duration,
            (double)e.X/wave.Width*report.tracks[selected].duration));
        if(e.Button==MouseButtons.Right){
            if(playing){Mci("seek "+Alias+" to "+(int)(seconds*1000));Mci("play "+Alias);}
            return;
        }
        SetDropFromX(e.X);
    }
    private void SetDropFromX(int x)
    {
        if(selected<0||report==null||wave.Width<=0)return;
        double seconds=(double)x/wave.Width*report.tracks[selected].duration;
        drop.Value=(decimal)Math.Max((double)drop.Minimum,Math.Min((double)drop.Maximum,seconds));
    }
    private void DrawWave(object sender,PaintEventArgs e)
    {
        e.Graphics.Clear(wave.BackColor);
        if(selected<0||report==null)return;
        int mid=wave.Height/2;
        using(var baseline=new Pen(Color.FromArgb(60,90,110)))e.Graphics.DrawLine(baseline,0,mid,wave.Width,mid);
        if(peaks!=null)using(var pen=new Pen(HeatVisualTheme.ElectricBlue)){
            for(int x=0;x<wave.Width;x++){
                int bin=x*peaks.Length/Math.Max(1,wave.Width);
                int h=Math.Max(1,(int)(peaks[bin]*(mid-6)));
                e.Graphics.DrawLine(pen,x,mid-h,x,mid+h);
            }
        }
        double duration=report.tracks[selected].duration;
        int dx=(int)((double)drop.Value/duration*wave.Width);
        using(var pen=new Pen(HeatVisualTheme.ElectricRose,2))e.Graphics.DrawLine(pen,dx,0,dx,wave.Height);
        if(playing){int px=(int)(Position()/1000.0/duration*wave.Width);
            using(var pen=new Pen(HeatVisualTheme.Reward,2))e.Graphics.DrawLine(pen,px,0,px,wave.Height);}
    }
    public string Save()
    {
        if(report==null)throw new InvalidOperationException("Analyze a folder or import a preset before editing.");
        grid.EndEdit();
        var plan=new EditedPlan{version=1,playlists=new Dictionary<string,List<int>>(),
            menu=-1,drops=new double[report.tracks.Length]};
        for(int k=0;k<Keys.Length;k++)plan.playlists[Keys[k]]=new List<int>();
        for(int i=0;i<grid.Rows.Count;i++){
            var row=grid.Rows[i];
            for(int k=0;k<Keys.Length;k++)if(Convert.ToBoolean(row.Cells[k+1].Value))
                plan.playlists[Keys[k]].Add(i);
            if(Convert.ToBoolean(row.Cells[6].Value))plan.menu=i;
            double value;
            string raw=Convert.ToString(row.Cells[7].Value);
            if(!Double.TryParse(raw,NumberStyles.Float,CultureInfo.InvariantCulture,out value)&&
                !Double.TryParse(raw,NumberStyles.Float,CultureInfo.CurrentCulture,out value))
                throw new InvalidDataException("Invalid drop: "+row.Cells[0].Value);
            if(value<(double)MinimumDropSeconds||value>Math.Min(150,report.tracks[i].duration-8))
                throw new InvalidDataException("Drop out of range (16.2 s to 8 s before the end): "+row.Cells[0].Value);
            plan.drops[i]=Math.Round(value,1);
        }
        for(int k=0;k<Keys.Length;k++){
            int count=plan.playlists[Keys[k]].Count;
            if(count<1||count>Capacities[k])throw new InvalidDataException(
                Names[k]+" requires 1 to "+Capacities[k]+" tracks (currently "+count+").");
        }
        if(plan.menu<0||Double.IsNaN(report.tracks[plan.menu].duration)||Double.IsInfinity(report.tracks[plan.menu].duration)||report.tracks[plan.menu].duration<=12)
            throw new InvalidDataException("Select a track longer than 12 seconds for the menu.");
        foreach(int k in new[]{3,4})foreach(int i in plan.playlists[Keys[k]])
            if(report.tracks[i].duration<30)throw new InvalidDataException(
                "Races require tracks at least 30 seconds long: "+Path.GetFileName(report.tracks[i].file));
        string path=Path.Combine(Path.GetDirectoryName(reportPath),"editor.json");
        File.WriteAllText(path,json.Serialize(plan),new UTF8Encoding(false));
        message.Text="Settings saved to "+Path.GetFileName(path);
        return path;
    }
    protected override void Dispose(bool disposing)
    {
        if(disposing){StopAudio();playbackTimer.Dispose();}
        base.Dispose(disposing);
    }
}
