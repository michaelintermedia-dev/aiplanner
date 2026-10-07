# Keeps the PC from sleeping while a long job runs (builds, deploys, tests).
# The screen may still turn off and lock - only sleep is held off.
#   tools/keep-awake.ps1 -Start [-Minutes 180]   # starts a hidden helper, returns at once
#   tools/keep-awake.ps1 -Stop                   # normal sleep settings apply again
# The helper also ends by itself after -Minutes, so the PC never stays awake for good.
param([switch]$Start, [switch]$Stop, [int]$Minutes = 180, [switch]$Hold)

$pidFile = Join-Path $PSScriptRoot 'qa\.local\keep-awake.pid'

if ($Hold) {
    # The helper itself: ES_CONTINUOUS | ES_SYSTEM_REQUIRED, refreshed every minute.
    Add-Type -Namespace Power -Name Native -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
    $until = (Get-Date).AddMinutes($Minutes)
    while ((Get-Date) -lt $until) {
        [void][Power.Native]::SetThreadExecutionState([uint32]'0x80000001')
        Start-Sleep -Seconds 60
    }
    [void][Power.Native]::SetThreadExecutionState([uint32]'0x80000000')
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    return
}

function Stop-Helper {
    if (Test-Path $pidFile) {
        $old = Get-Content $pidFile
        Get-Process -Id $old -ErrorAction SilentlyContinue | Stop-Process -Force -Confirm:$false -PassThru | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
}

if ($Stop) {
    Stop-Helper
    'keep-awake: off'
}
elseif ($Start) {
    Stop-Helper # one at a time
    New-Item -ItemType Directory -Force (Split-Path $pidFile) | Out-Null
    $p = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Hold', '-Minutes', $Minutes)
    Set-Content -Path $pidFile -Value $p.Id
    "keep-awake: on for up to $Minutes min (pid $($p.Id))"
}
else {
    'Use -Start [-Minutes N] or -Stop'
}
