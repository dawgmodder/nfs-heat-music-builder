$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath '.').Path
$compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe /reference:System.Drawing.dll /out:work\BuildHeatIcon.exe work\BuildHeatIcon.cs work\HeatMusicBrand.cs
if($LASTEXITCODE -ne 0){throw 'Icon tool compilation failed'}
& "$root\work\BuildHeatIcon.exe" "$root\work\HeatMusic.ico"
& $compiler /nologo /target:winexe /platform:x64 /debug- /out:work\HeatMusicInstallerV4.exe /win32icon:work\HeatMusic.ico /win32manifest:work\HeatMusicInstaller.manifest /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll work\HeatMusicBrand.cs work\HeatVisualTheme.cs work\HeatMusicInstallerV3.cs work\HeatMusicPlanEditor.cs work\HeatMusicPresetStore.cs
if($LASTEXITCODE -ne 0){throw 'Installer compilation failed'}
