<#
.SYNOPSIS
  Sends the daily OSTEKS-Auswertungen workbook from the network share to the
  Osteks app (Production View), so nobody has to upload it by hand.

.DESCRIPTION
  Runs on a Windows machine that can open the share (see SETUP.md), started
  by Windows Task Scheduler every morning at 05:00:

    1. finds the newest "OSTEKS-Auswertungen-*.xlsx" in the share
       (the year in the name changes every January - the pattern follows it);
    2. waits until the file has stopped changing, then copies it locally
       (so a file that is still being written is never sent);
    3. uploads it to POST <serverUrl>/api/production/import/auto with the
       secret key in the X-Import-Key header;
    4. the server imports it (same importer as a manual upload). If the
       file is the same as the last import - not updated yet - it tries
       again every 30 minutes until 08:00; the last attempt is marked
       "final", so the app's Upload history shows "No new data" for that
       morning.

  Everything it does is written to osteks-sync.log next to this script.
  Windows PowerShell 5.1 (built into Windows) is enough - nothing to install.

.PARAMETER ConfigPath
  Settings file (default: osteks-sync.config.json next to this script).

.PARAMETER Once
  One attempt only, no waiting/retrying - for testing by hand.

.NOTES
  Exit codes (shown in Task Scheduler's "Last Run Result"):
    0  imported, or no new data this morning (both are normal)
    2  the server could not read the file
    3  the server refused: wrong key, or automatic import switched off
    4  the server could not be reached until the give-up time
    5  no workbook found in the share (or the share is not reachable)
    9  the settings file is missing or incomplete
#>
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "osteks-sync.config.json"),
    [switch]$Once
)

$ErrorActionPreference = "Stop"
$LogPath = Join-Path $PSScriptRoot "osteks-sync.log"

function Write-Log([string]$Message) {
    # keep the log small: start a new one past 1 MB (the old one is kept once)
    if ((Test-Path $LogPath) -and (Get-Item $LogPath).Length -gt 1MB) {
        Move-Item $LogPath "$LogPath.old" -Force
    }
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

# ---------------------------------------------------------------- settings
if (-not (Test-Path $ConfigPath)) {
    Write-Log "ERROR settings file not found: $ConfigPath (copy osteks-sync.config.example.json to osteks-sync.config.json and fill it in)"
    exit 9
}
$config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($name in "sourceFolder", "filePattern", "serverUrl", "importKey") {
    if (-not $config.$name -or $config.$name -like "PASTE*" -or $config.$name -like "*xxxx*") {
        Write-Log "ERROR setting '$name' is empty or still the example value in $ConfigPath"
        exit 9
    }
}
$retryMinutes = if ($config.retryEveryMinutes) { [int]$config.retryEveryMinutes } else { 30 }
$giveUpAt = [datetime]::ParseExact($(if ($config.giveUpAt) { $config.giveUpAt } else { "08:00" }), "HH:mm", $null)
$uploadUrl = $config.serverUrl.TrimEnd("/") + "/api/production/import/auto"

# ---------------------------------------------------------------- helpers
function Find-Workbook {
    # newest matching file; Excel's own "~$..." lock files are ignored
    Get-ChildItem -LiteralPath $config.sourceFolder -Filter $config.filePattern -File |
        Where-Object { $_.Name -notlike '~$*' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}

function Copy-WhenStable($file) {
    # The file may still be being written by the system that fills the
    # share - wait until its size and time stop changing, then copy it.
    for ($try = 1; $try -le 10; $try++) {
        $before = Get-Item -LiteralPath $file.FullName
        Start-Sleep -Seconds 15
        $after = Get-Item -LiteralPath $file.FullName
        if ($before.Length -eq $after.Length -and $before.LastWriteTime -eq $after.LastWriteTime -and $after.Length -gt 0) {
            # .NET file calls, not Copy-Item/Remove-Item: on some machines the
            # temp folder is a short "C:\Users\K3C05~1.SAT\..." path that the
            # PowerShell cmdlets fail to resolve
            $copy = [IO.Path]::Combine([IO.Path]::GetTempPath(), "osteks-sync-" + [guid]::NewGuid().ToString("N") + ".xlsx")
            try {
                [IO.File]::Copy($after.FullName, $copy, $true)
                return $copy
            } catch {
                Write-Log "file is locked, waiting ($($_.Exception.Message))"
            }
        }
    }
    throw "the file kept changing or stayed locked for over 2 minutes"
}

function Send-Workbook([string]$path, [string]$fileName, [bool]$final) {
    Add-Type -AssemblyName System.Net.Http
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $client = New-Object System.Net.Http.HttpClient
    # Cloud Run may need a few seconds to start when nobody used it overnight
    $client.Timeout = [TimeSpan]::FromSeconds(180)
    $client.DefaultRequestHeaders.Add("X-Import-Key", $config.importKey)
    try {
        $form = New-Object System.Net.Http.MultipartFormDataContent
        $bytes = [IO.File]::ReadAllBytes($path)
        $fileContent = New-Object System.Net.Http.ByteArrayContent -ArgumentList (, $bytes)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        $form.Add($fileContent, "file", $fileName)
        $url = $uploadUrl + $(if ($final) { "?final=true" } else { "" })
        $response = $client.PostAsync($url, $form).GetAwaiter().GetResult()
        $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $body = $null
        try { $body = $text | ConvertFrom-Json } catch { }
        return [pscustomobject]@{ Code = [int]$response.StatusCode; Body = $body; Text = $text }
    } finally {
        $client.Dispose()
    }
}

# ---------------------------------------------------------------- main loop
$deadline = (Get-Date).Date.Add($giveUpAt.TimeOfDay)
Write-Log "start - share $($config.sourceFolder), give up at $($deadline.ToString('HH:mm'))$(if ($Once) { ' (single test run)' })"
$exitCode = 0

while ($true) {
    # last attempt when testing, or when the next one would be past the give-up time
    $final = $Once -or ((Get-Date).AddMinutes($retryMinutes) -gt $deadline)
    $retry = $false
    $copy = $null
    try {
        $reachable = Test-Path -LiteralPath $config.sourceFolder
        $file = if ($reachable) { Find-Workbook } else { $null }
        if (-not $reachable) {
            # share offline, or this Windows user has no access to it
            Write-Log "share not reachable: $($config.sourceFolder) (offline, or no access for user $env:USERDOMAIN\$env:USERNAME)"
            $exitCode = 5
            $retry = $true
        } elseif (-not $file) {
            Write-Log "no file matching '$($config.filePattern)' in $($config.sourceFolder)"
            $exitCode = 5
            $retry = $true
        } else {
            Write-Log "found $($file.Name) (changed $($file.LastWriteTime.ToString('dd.MM.yyyy HH:mm')), $([math]::Round($file.Length / 1KB)) KB)"
            $copy = Copy-WhenStable $file
            $result = Send-Workbook $copy $file.Name $final
            $status = if ($result.Body) { $result.Body.status } else { $null }

            if ($result.Code -eq 200 -and $status -eq "committed") {
                $summary = $result.Body.upload.summary
                Write-Log ("IMPORTED - {0} new / {1} changed values, data up to {2}" -f `
                    $summary.values.new, $summary.values.changed, $summary.lastDate)
                $exitCode = 0
                break
            } elseif ($result.Code -eq 200 -and $status -eq "unchanged") {
                if ($final) {
                    Write-Log "no new data this morning - the file has not changed since the last import (recorded in the app)"
                    $exitCode = 0
                    break
                }
                Write-Log "file not updated yet - trying again in $retryMinutes minutes"
                $retry = $true
            } elseif ($result.Code -eq 401 -or $result.Code -eq 503) {
                Write-Log "REFUSED by the server ($($result.Code)): $($result.Text) - check importKey / PRODUCTION_IMPORT_KEY"
                $exitCode = 3
                break
            } elseif ($result.Code -eq 422) {
                Write-Log "server could not read the file: $($result.Body.error)"
                $exitCode = 2
                $retry = $true   # maybe it was caught mid-write; try again
            } else {
                Write-Log "unexpected answer ($($result.Code)): $($result.Text)"
                $exitCode = 4
                $retry = $true
            }
        }
    } catch {
        Write-Log "ERROR $($_.Exception.Message)"
        $exitCode = if ($exitCode -eq 5) { 5 } else { 4 }
        $retry = $true
    } finally {
        # cleanup must never turn a successful run into a failed one
        if ($copy) {
            try { [IO.File]::Delete($copy) } catch { Write-Log "note: could not delete the temporary copy $copy" }
        }
    }

    if (-not $retry -or $final) { break }
    $wait = [math]::Max(60, [math]::Min($retryMinutes * 60, ($deadline - (Get-Date)).TotalSeconds))
    Start-Sleep -Seconds ([int]$wait)
}

Write-Log "end (exit code $exitCode)"
exit $exitCode
