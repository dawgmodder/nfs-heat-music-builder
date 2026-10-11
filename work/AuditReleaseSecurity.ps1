$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$package=Join-Path $root 'output\HeatMusicPortableV4_1_Distribution'
$report=Join-Path $root 'output\security-audit-v4-1'
New-Item -ItemType Directory -Path $report -Force | Out-Null
$items=@(Get-ChildItem -LiteralPath $package -Recurse -File | ForEach-Object {
  $signature=if($_.Extension -in @('.exe','.dll')){Get-AuthenticodeSignature -LiteralPath $_.FullName}else{$null}
  [pscustomobject]@{File=$_.FullName.Substring($package.Length+1);Bytes=$_.Length;SHA256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant();Signature=if($signature){[string]$signature.Status}else{'NotApplicable'};Signer=if($signature.SignerCertificate){$signature.SignerCertificate.Subject}else{''}}
})
$items | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $report 'file-inventory.json') -Encoding UTF8
$items | Where-Object {$_.File -match '\.exe$'} | Format-Table -AutoSize
Get-ChildItem -LiteralPath (Join-Path $root 'work') -Filter '*.cs' | Select-String -Pattern 'AssemblyVersion|AssemblyTitle|DllImport|DownloadString|DownloadFile|WebClient|HttpClient|Process.Start|WriteProcessMemory|CreateRemoteThread|VirtualAlloc' | Select-Object Path,LineNumber,Line | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $report 'source-review-index.json') -Encoding UTF8
Write-Output ('AUDIT_REPORT '+$report)
