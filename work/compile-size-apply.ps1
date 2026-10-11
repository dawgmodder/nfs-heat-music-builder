$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath '.').Path
$runtime='C:\Users\WIN10\AppData\Local\HeatMusicReplacer\Runtime'
$compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe /platform:x64 /debug- "/out:$root\work\CreateNoLaunchFrostySupport.exe" "$root\work\CreateNoLaunchFrostySupport.cs"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& "$root\work\CreateNoLaunchFrostySupport.exe" "$root"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$compileArgs=@(
  '/nologo', '/target:exe', '/platform:x64', '/debug-',
  "/out:$root\work\ApplyHeatTrack24Size.exe",
  "/reference:$runtime\FrostyCore.dll",
  "/reference:$runtime\FrostySdk.dll",
  "/reference:$runtime\FrostyModSupport.dll",
  "/reference:$runtime\FrostyControls.dll",
  '/reference:C:\Windows\Microsoft.NET\assembly\GAC_64\PresentationCore\v4.0_4.0.0.0__31bf3856ad364e35\PresentationCore.dll',
  '/reference:C:\Windows\Microsoft.NET\assembly\GAC_MSIL\PresentationFramework\v4.0_4.0.0.0__31bf3856ad364e35\PresentationFramework.dll',
  '/reference:C:\Windows\Microsoft.NET\assembly\GAC_MSIL\WindowsBase\v4.0_4.0.0.0__31bf3856ad364e35\WindowsBase.dll',
  '/reference:C:\Windows\Microsoft.NET\assembly\GAC_MSIL\System.Xaml\v4.0_4.0.0.0__b77a5c561934e089\System.Xaml.dll',
  "$root\work\ApplyHeatTrack24Size.cs"
)
& $compiler @compileArgs
exit $LASTEXITCODE
