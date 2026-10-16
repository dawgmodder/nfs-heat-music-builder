using System;
internal static class TestHeatGameLauncher
{
    private static void Main(){string value=HeatGameLauncher.BuildSteamArguments("ModData/HeatMusicV5");if(value!="-applaunch 1222680 -dataPath \"ModData/HeatMusicV5\"")throw new Exception("Unexpected Steam arguments: "+value);bool rejected=false;try{HeatGameLauncher.BuildSteamArguments("bad\"path");}catch(ArgumentException){rejected=true;}if(!rejected)throw new Exception("Unsafe path was accepted");Console.WriteLine("PASS Steam AppID, dataPath forwarding and unsafe-path rejection.");}
}
