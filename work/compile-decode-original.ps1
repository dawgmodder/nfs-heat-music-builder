$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath '.').Path
$compiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe /platform:x64 "/out:$root\work\DecodeOriginalEaForLoudness.exe" "$root\work\DecodeOriginalEaForLoudness.cs"
exit $LASTEXITCODE
