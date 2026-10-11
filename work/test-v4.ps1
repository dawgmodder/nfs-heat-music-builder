$ErrorActionPreference='Stop'
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:exe /out:work\TestV4Ui.exe /reference:System.Drawing.dll /reference:System.Windows.Forms.dll work\TestV4Ui.cs
if($LASTEXITCODE -ne 0){throw 'Test compilation failed'}
& .\work\TestV4Ui.exe
if($LASTEXITCODE -ne 0){throw 'UI test failed'}
