# Rebuild release executables into an isolated audit directory. Does not run
# installers, patch Frosty, access game data, or overwrite distribution files.
param([string]$FrostyRuntime)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
if(!$FrostyRuntime){$FrostyRuntime=Join-Path $env:LOCALAPPDATA 'HeatMusicReplacer\Runtime'}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$target=Join-Path $root 'output\security-audit-v4-1\rebuilt'
if(Test-Path -LiteralPath $target){throw 'Audit rebuild directory exists; preserve previous evidence and choose a fresh directory.'}
New-Item -ItemType Directory -Path $target | Out-Null
$wpf=@('PresentationCore','PresentationFramework','WindowsBase','System.Xaml') | ForEach-Object {
  $assembly=Get-ChildItem -LiteralPath (Join-Path $env:WINDIR 'Microsoft.NET\assembly') -Recurse -Filter ($_+'.dll') | Where-Object {$_.FullName -notmatch '\\GAC_32\\'} | Select-Object -First 1
  if(!$assembly){throw ('Reference missing: '+$_)}
  '/reference:'+$assembly.FullName
}
$frosty=@('FrostyCore','FrostySdk','FrostyControls') | ForEach-Object {'/reference:'+(Join-Path $FrostyRuntime ($_+'.dll'))}
$jobs=@(
  @{Name='CreateNoLaunchFrostySupport.exe';Sources=@('CreateNoLaunchFrostySupport.cs');Refs=@();Extra=@()},
  @{Name='ExtractTrustedZip.exe';Sources=@('ExtractTrustedZip.cs');Refs=@('/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll');Extra=@()},
  @{Name='DecodeOriginalEaForLoudness.exe';Sources=@('DecodeOriginalEaForLoudness.cs');Refs=@();Extra=@()},
  @{Name='ApplyHeatTrack24Size.exe';Sources=@('ApplyHeatTrack24Size.cs');Refs=$frosty+$wpf+@('/reference:'+(Join-Path $FrostyRuntime 'FrostyModSupport.dll'));Extra=@()},
  @{Name='HeatTrack24SizeMod.exe';Sources=@('HeatTrack24SizeMod.cs');Refs=$frosty+$wpf;Extra=@()},
  @{Name='HeatMusicInstallerV4.exe';Sources=@('HeatMusicBrand.cs','HeatVisualTheme.cs','HeatMusicInstallerV3.cs','HeatMusicPlanEditor.cs','HeatMusicPresetStore.cs');Refs=@('/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.Web.Extensions.dll','/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll');Extra=@('/target:winexe',('/win32icon:'+(Join-Path $PSScriptRoot 'HeatMusic.ico')),('/win32manifest:'+(Join-Path $PSScriptRoot 'HeatMusicInstaller.manifest')))}
)
$results=@()
foreach($job in $jobs){
  $out=Join-Path $target $job.Name
  $sources=@($job.Sources | ForEach-Object {Join-Path $PSScriptRoot $_})
  $arguments=@('/nologo','/target:exe','/platform:x64','/debug-',('/out:'+$out))+$job.Extra+$job.Refs+$sources
  & $compiler @arguments
  if($LASTEXITCODE -ne 0){throw ('Compilation failed: '+$job.Name)}
  $results += [pscustomobject]@{File=$job.Name;SHA256=(Get-FileHash -LiteralPath $out).Hash.ToLowerInvariant();Sources=@($sources | ForEach-Object {[pscustomobject]@{File=[IO.Path]::GetFileName($_);SHA256=(Get-FileHash -LiteralPath $_).Hash.ToLowerInvariant()}});CompilerSHA256=(Get-FileHash -LiteralPath $compiler).Hash.ToLowerInvariant()}
  Write-Output ('REBUILT '+$job.Name)
}
$results | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $target 'build-provenance.json') -Encoding UTF8
