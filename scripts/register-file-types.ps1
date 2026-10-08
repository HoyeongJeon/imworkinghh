param([string]$ExePath = (Join-Path $PSScriptRoot '..\dist\win-unpacked\imworkinghh.exe'))
$exe = (Resolve-Path $ExePath).Path
$classes = 'HKCU:\Software\Classes'
$progId = 'imworkinghh.document'
$command = "`"$exe`" `"%1`""

# New-Item -Force는 이미 있는 키를 지우고 다시 만들어서 다른 앱의 연결까지 지운다. 없을 때만 만든다.
function Use-Key([string]$Path) {
  if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
  return $Path
}

Set-Item -Path (Use-Key "$classes\$progId") -Value 'imworkinghh document'
Set-Item -Path (Use-Key "$classes\$progId\shell\open\command") -Value $command

$app = Use-Key "$classes\Applications\imworkinghh.exe"
Set-ItemProperty -Path $app -Name 'FriendlyAppName' -Value 'imworkinghh'
Set-Item -Path (Use-Key "$app\shell\open\command") -Value $command
$supportedTypes = Use-Key "$app\SupportedTypes"

foreach ($extension in '.md', '.markdown', '.txt') {
  $openWith = Use-Key "$classes\$extension\OpenWithProgids"
  New-ItemProperty -Path $openWith -Name $progId -Value '' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $supportedTypes -Name $extension -Value '' -PropertyType String -Force | Out-Null
}
"registered: $exe"
