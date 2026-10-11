using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

internal static class HeatVisualTheme
{
    internal static readonly Color Void=Color.FromArgb(8,9,14);
    internal static readonly Color Asphalt=Color.FromArgb(17,19,27);
    internal static readonly Color Panel=Color.FromArgb(25,28,38);
    internal static readonly Color PanelRaised=Color.FromArgb(35,38,49);
    internal static readonly Color Text=Color.FromArgb(244,246,250);
    internal static readonly Color Muted=Color.FromArgb(164,171,187);
    internal static readonly Color ElectricBlue=Color.FromArgb(21,203,235);
    internal static readonly Color ElectricRose=Color.FromArgb(255,42,126);
    internal static readonly Color Reward=Color.FromArgb(255,219,45);
    internal static readonly Color Grid=Color.FromArgb(58,64,78);

    internal static Font Ui(float size,FontStyle style=FontStyle.Regular)
    {
        try{return new Font("Segoe UI",size,style,GraphicsUnit.Point);}
        catch{return new Font("Segoe UI",size,style,GraphicsUnit.Point);}
    }
    internal static void StyleButton(Button button,bool primary=false)
    {
        button.FlatStyle=FlatStyle.Flat;button.FlatAppearance.BorderSize=1;
        button.FlatAppearance.BorderColor=primary?ElectricRose:Color.FromArgb(98,105,124);
        button.BackColor=primary?ElectricRose:Color.FromArgb(33,36,47);
        button.ForeColor=Text;button.Font=Ui(10,FontStyle.Bold);
        button.Cursor=Cursors.Hand;button.UseVisualStyleBackColor=false;
        button.FlatAppearance.MouseOverBackColor=primary?Color.FromArgb(255,70,146):Color.FromArgb(48,53,68);
        button.FlatAppearance.MouseDownBackColor=primary?Color.FromArgb(208,18,91):Color.FromArgb(21,203,235);
        button.Paint+=(s,e)=>{
            if(button.Enabled)return;
            e.Graphics.Clear(Panel);
            using(var pen=new Pen(Grid))e.Graphics.DrawRectangle(pen,0,0,button.Width-1,button.Height-1);
            TextRenderer.DrawText(e.Graphics,button.Text,button.Font,button.ClientRectangle,Muted,
                TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
        };
    }
    internal static void StyleTabs(TabControl tabs)
    {
        tabs.DrawMode=TabDrawMode.OwnerDrawFixed;tabs.SizeMode=TabSizeMode.Fixed;
        tabs.ItemSize=new Size(210,42);tabs.Padding=new Point(0,0);
        tabs.DrawItem+=(sender,e)=>{
            bool selected=e.Index==tabs.SelectedIndex;
            Rectangle r=e.Bounds;
            using(var fill=new SolidBrush(selected?PanelRaised:Asphalt))e.Graphics.FillRectangle(fill,r);
            using(var line=new SolidBrush(selected?ElectricRose:Grid))
                e.Graphics.FillRectangle(line,r.X,r.Bottom-4,r.Width,4);
            using(var font=Ui(10,FontStyle.Bold))TextRenderer.DrawText(e.Graphics,tabs.TabPages[e.Index].Text.ToUpperInvariant(),font,
                r,selected?Text:Muted,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);
        };
    }
    internal static void StyleGrid(DataGridView grid)
    {
        grid.BorderStyle=BorderStyle.None;grid.CellBorderStyle=DataGridViewCellBorderStyle.SingleHorizontal;
        grid.GridColor=Grid;grid.EnableHeadersVisualStyles=false;grid.BackgroundColor=Void;
        grid.ColumnHeadersBorderStyle=DataGridViewHeaderBorderStyle.None;
        grid.ColumnHeadersDefaultCellStyle.BackColor=Color.FromArgb(31,34,45);
        grid.ColumnHeadersDefaultCellStyle.ForeColor=Text;
        grid.ColumnHeadersDefaultCellStyle.Font=Ui(9,FontStyle.Bold);
        grid.ColumnHeadersDefaultCellStyle.SelectionBackColor=Color.FromArgb(31,34,45);
        grid.ColumnHeadersHeight=52;
        grid.ColumnHeadersDefaultCellStyle.WrapMode=DataGridViewTriState.True;
        grid.DefaultCellStyle.BackColor=Color.FromArgb(19,21,29);
        grid.DefaultCellStyle.ForeColor=Text;
        grid.DefaultCellStyle.SelectionBackColor=Color.FromArgb(26,109,132);
        grid.DefaultCellStyle.SelectionForeColor=Color.White;
        grid.DefaultCellStyle.Font=Ui(9);
        grid.AlternatingRowsDefaultCellStyle.BackColor=Color.FromArgb(23,25,34);
        grid.RowTemplate.Height=32;
    }
}

internal sealed class HeatNavigationTabs : TabControl
{
    protected override void WndProc(ref Message m)
    {
        // External keyboard-accessible navigation owns the strip; pages fill the client area.
        if(m.Msg==0x1328&&!DesignMode){m.Result=new IntPtr(1);return;}
        base.WndProc(ref m);
    }
}

internal sealed class HeatHeaderPanel : Panel
{
    internal HeatHeaderPanel(){DoubleBuffered=true;Height=76;Dock=DockStyle.Top;}
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);Rectangle r=ClientRectangle;
        using(var brush=new LinearGradientBrush(r,Color.FromArgb(32,12,38),Color.FromArgb(7,34,46),0f))
            e.Graphics.FillRectangle(brush,r);
        e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;
        using(var rose=new SolidBrush(Color.FromArgb(120,255,42,126)))
            e.Graphics.FillPolygon(rose,new[]{new Point(Width-330,0),new Point(Width-70,0),new Point(Width-170,Height),new Point(Width-430,Height)});
        using(var blue=new Pen(Color.FromArgb(180,21,203,235),3))
            e.Graphics.DrawLine(blue,0,Height-2,Width,Height-2);
        using(var mark=HeatMusicBrand.Mark(48))e.Graphics.DrawImage(mark,20,12,48,48);
        using(var title=HeatVisualTheme.Ui(23,FontStyle.Bold))TextRenderer.DrawText(e.Graphics,"HEAT MUSIC BUILDER",title,new Point(80,9),HeatVisualTheme.Text);
        using(var subtitle=HeatVisualTheme.Ui(9,FontStyle.Bold))TextRenderer.DrawText(e.Graphics,"FOR NFS HEAT  /  COMMUNITY TOOL",subtitle,
            new Point(83,46),HeatVisualTheme.ElectricBlue);
    }
}

internal sealed class HeatSurfacePanel : TableLayoutPanel
{
    internal HeatSurfacePanel(){DoubleBuffered=true;BackColor=HeatVisualTheme.Asphalt;}
    protected override void OnPaintBackground(PaintEventArgs e)
    {
        e.Graphics.Clear(HeatVisualTheme.Asphalt);
    }
}
