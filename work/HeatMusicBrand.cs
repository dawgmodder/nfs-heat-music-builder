using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;

internal static class HeatMusicBrand
{
    [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr handle);
    internal static Bitmap Mark(int size)
    {
        var bitmap=new Bitmap(size,size);
        using(var g=Graphics.FromImage(bitmap)){
            g.SmoothingMode=SmoothingMode.AntiAlias;g.Clear(Color.FromArgb(17,19,27));
            float scale=size/64f;g.ScaleTransform(scale,scale);
            using(var pen=new Pen(Color.FromArgb(21,203,235),5)){
                pen.StartCap=pen.EndCap=LineCap.Round;
                g.DrawLine(pen,15,26,15,38);g.DrawLine(pen,26,17,26,47);
            }
            using(var pen=new Pen(Color.FromArgb(255,42,126),5)){
                pen.StartCap=pen.EndCap=LineCap.Round;
                g.DrawLine(pen,38,11,38,53);g.DrawLine(pen,49,24,49,40);
            }
        }return bitmap;
    }
    internal static Icon CreateIcon(){using(var b=Mark(64)){var handle=b.GetHicon();try{return (Icon)Icon.FromHandle(handle).Clone();}finally{DestroyIcon(handle);}}}
    // Multi-resolution ICO for Explorer, taskbar, Alt+Tab and window chrome.
    internal static void WriteIcon(string file){
        int[] sizes={16,24,32,48,64,128,256};var images=new byte[sizes.Length][];
        for(int i=0;i<sizes.Length;i++)using(var b=Mark(sizes[i]))using(var m=new MemoryStream()){b.Save(m,System.Drawing.Imaging.ImageFormat.Png);images[i]=m.ToArray();}
        using(var w=new BinaryWriter(File.Create(file))){w.Write((ushort)0);w.Write((ushort)1);w.Write((ushort)sizes.Length);int offset=6+16*sizes.Length;
            for(int i=0;i<sizes.Length;i++){w.Write((byte)(sizes[i]==256?0:sizes[i]));w.Write((byte)(sizes[i]==256?0:sizes[i]));w.Write((byte)0);w.Write((byte)0);w.Write((ushort)1);w.Write((ushort)32);w.Write(images[i].Length);w.Write(offset);offset+=images[i].Length;}
            foreach(var image in images)w.Write(image);
        }
    }
}
