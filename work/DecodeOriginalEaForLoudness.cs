using System;
using System.IO;
using System.Reflection;
using System.Reflection.Emit;

internal static class DecodeOriginalEaForLoudness
{
    private static readonly string Runtime = Environment.GetEnvironmentVariable("HEAT_MUSIC_FROSTY_RUNTIME") ?? @"C:\Users\WIN10\AppData\Local\HeatMusicReplacer\Runtime";
    private static FileStream output;
    private static long sampleValues;
    private static double squares;
    private static int peak;
    private static int callbacks;

    private static Assembly Resolve(object sender, ResolveEventArgs e)
    {
        string name = new AssemblyName(e.Name).Name + ".dll";
        foreach (string folder in new[] { Runtime, Path.Combine(Runtime, "Plugins"),
            Path.Combine(Runtime, "ThirdParty"), Path.Combine(Runtime, "Profiles") })
        {
            string path = Path.Combine(folder, name);
            if (File.Exists(path)) return Assembly.LoadFrom(path);
        }
        return null;
    }

    public static void OnAudio(short[] samples, int value)
    {
        if (callbacks++ < 3) Console.WriteLine("CALLBACK samples=" + (samples == null ? -1 : samples.Length) + " int=" + value);
        if (samples == null || samples.Length == 0) return;
        byte[] bytes = new byte[samples.Length * 2];
        Buffer.BlockCopy(samples, 0, bytes, 0, bytes.Length);
        output.Write(bytes, 0, bytes.Length);
        foreach (short sample in samples)
        {
            int abs = sample == short.MinValue ? 32768 : Math.Abs((int)sample);
            if (abs > peak) peak = abs;
            squares += (double)sample * sample;
        }
        sampleValues += samples.Length;
    }

    private static Delegate MakeCallback(Type callbackType)
    {
        MethodInfo invoke = callbackType.GetMethod("Invoke");
        ParameterInfo[] parameters = invoke.GetParameters();
        Type[] types = new Type[parameters.Length];
        for (int i = 0; i < types.Length; i++) types[i] = parameters[i].ParameterType;
        DynamicMethod dynamic = new DynamicMethod("AudioCallback", typeof(void), types,
            typeof(DecodeOriginalEaForLoudness).Module, true);
        ILGenerator il = dynamic.GetILGenerator();
        il.Emit(OpCodes.Ldarg_0);
        il.Emit(OpCodes.Ldarg_1);
        il.Emit(OpCodes.Call, typeof(DecodeOriginalEaForLoudness).GetMethod("OnAudio"));
        il.Emit(OpCodes.Ret);
        return dynamic.CreateDelegate(callbackType);
    }

    private static void WriteWaveHeader(FileStream stream, int dataBytes)
    {
        BinaryWriter writer = new BinaryWriter(stream);
        writer.Write(new char[] { 'R', 'I', 'F', 'F' });
        writer.Write(36 + dataBytes);
        writer.Write(new char[] { 'W', 'A', 'V', 'E' });
        writer.Write(new char[] { 'f', 'm', 't', ' ' });
        writer.Write(16);
        writer.Write((short)1);
        writer.Write((short)2);
        writer.Write(48000);
        writer.Write(48000 * 4);
        writer.Write((short)4);
        writer.Write((short)16);
        writer.Write(new char[] { 'd', 'a', 't', 'a' });
        writer.Write(dataBytes);
    }

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 2) throw new ArgumentException("Input raw EA and output WAV required");
            string inputPath = Path.GetFullPath(args[0]);
            string outputPath = Path.GetFullPath(args[1]);
            if (File.Exists(outputPath)) throw new InvalidOperationException("Output exists");
            AppDomain.CurrentDomain.AssemblyResolve += Resolve;
            Environment.CurrentDirectory = Path.Combine(Runtime, "ThirdParty");
            Assembly plugin = Assembly.LoadFrom(Path.Combine(Runtime, "Plugins", "SoundEditorPlugin.dll"));
            Type decoder = plugin.GetType("SoundEditorPlugin.EALayer3", true);
            MethodInfo method = decoder.GetMethod("Decode", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            Delegate callback = MakeCallback(method.GetParameters()[2].ParameterType);
            byte[] raw = File.ReadAllBytes(inputPath);
            output = new FileStream(outputPath, FileMode.CreateNew, FileAccess.ReadWrite);
            WriteWaveHeader(output, 0);
            try { method.Invoke(null, new object[] { raw, raw.Length, callback }); }
            finally
            {
                if (sampleValues * 2 > Int32.MaxValue) throw new InvalidDataException("WAV too large");
                output.Position = 0;
                WriteWaveHeader(output, (int)(sampleValues * 2));
                output.Dispose();
            }
            double rms = Math.Sqrt(squares / sampleValues) / 32768.0;
            Console.WriteLine("DECODED samples=" + sampleValues + " callbacks=" + callbacks +
                " seconds=" + ((double)sampleValues / 2 / 48000).ToString("F3") +
                " peak_dBFS=" + (20 * Math.Log10(peak / 32768.0)).ToString("F3") +
                " rms_dBFS=" + (20 * Math.Log10(rms)).ToString("F3") +
                " output=" + outputPath);
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
    }
}
