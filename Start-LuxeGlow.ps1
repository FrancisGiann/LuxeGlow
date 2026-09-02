Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$minimumNodeVersion = [version]'22.12.0'
$nodeDownloadUrl = 'https://nodejs.org/en/download'
# Keep this aligned with server.port in frontend/vite.config.js. --strictPort
# below prevents opening a different app if this port is already occupied.
$serverUrl = 'http://localhost:5173/'
$scriptRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$frontendRoot = Join-Path -Path $scriptRoot -ChildPath 'frontend'

function Get-NodeInfo {
    $nodeCommand = Get-Command -Name 'node.exe' -ErrorAction SilentlyContinue
    if ($null -eq $nodeCommand) {
        $nodeCommand = Get-Command -Name 'node' -ErrorAction SilentlyContinue
    }

    if ($null -eq $nodeCommand) {
        return $null
    }

    try {
        $versionText = (& $nodeCommand.Source --version 2>&1 | Out-String).Trim()
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0 -or $versionText -notmatch '^\s*v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?\s*$') {
            return $null
        }

        $version = [version]("{0}.{1}.{2}" -f $Matches[1], $Matches[2], $Matches[3])
        return [pscustomobject]@{
            Path    = $nodeCommand.Source
            Version = $version
            Text    = $versionText
        }
    }
    catch {
        return $null
    }
}

function Refresh-ProcessPath {
    # The installer updates the user/machine PATH in the registry, but this
    # PowerShell process keeps its original environment until it is refreshed.
    $pathEntries = New-Object System.Collections.ArrayList
    $scopes = @('Machine', 'User')

    foreach ($scope in $scopes) {
        $scopePath = [Environment]::GetEnvironmentVariable('Path', $scope)
        if ($null -ne $scopePath) {
            $expandedScopePath = [Environment]::ExpandEnvironmentVariables($scopePath)
            foreach ($entry in ($expandedScopePath -split ';')) {
                $trimmedEntry = $entry.Trim()
                if ($trimmedEntry -and -not ($pathEntries -contains $trimmedEntry)) {
                    [void]$pathEntries.Add($trimmedEntry)
                }
            }
        }
    }

    # Keep process-only entries (for example, a package manager's shim) after
    # the refreshed machine/user entries.
    if ($null -ne $env:Path) {
        foreach ($entry in ($env:Path -split ';')) {
            $trimmedEntry = $entry.Trim()
            if ($trimmedEntry -and -not ($pathEntries -contains $trimmedEntry)) {
                [void]$pathEntries.Add($trimmedEntry)
            }
        }
    }

    $env:Path = $pathEntries -join ';'
}

function Install-NodeLts {
    $wingetCommand = Get-Command -Name 'winget.exe' -ErrorAction SilentlyContinue
    if ($null -eq $wingetCommand) {
        $wingetCommand = Get-Command -Name 'winget' -ErrorAction SilentlyContinue
    }

    if ($null -eq $wingetCommand) {
        throw "Node.js 22.12 or newer is required, but winget is not available. Install the official Node.js LTS from $nodeDownloadUrl, then double-click Start-LuxeGlow.bat again."
    }

    Write-Host 'Installing/updating official Node.js LTS through winget...' -ForegroundColor Cyan
    # WinGet's install command upgrades an installed matching package unless
    # --no-upgrade is supplied, so this handles first install and same-ID LTS
    # updates without relying on a separate upgrade-only command.
    & $wingetCommand.Source install --id 'OpenJS.NodeJS.LTS' --exact --source winget --accept-source-agreements --accept-package-agreements
    $wingetExitCode = $LASTEXITCODE
    if ($wingetExitCode -ne 0) {
        throw "winget could not install Node.js LTS (exit code $wingetExitCode). Install the official Node.js LTS from $nodeDownloadUrl, then double-click Start-LuxeGlow.bat again."
    }
}

function Get-NpmPath {
    $npmCommand = Get-Command -Name 'npm.cmd' -ErrorAction SilentlyContinue
    if ($null -eq $npmCommand) {
        $npmCommand = Get-Command -Name 'npm' -ErrorAction SilentlyContinue
    }

    if ($null -eq $npmCommand) {
        return $null
    }

    return $npmCommand.Source
}

$devProcess = $null
$scriptExitCode = 0

try {
    $packageJsonPath = Join-Path -Path $frontendRoot -ChildPath 'package.json'
    $packageLockPath = Join-Path -Path $frontendRoot -ChildPath 'package-lock.json'

    foreach ($requiredFile in @($packageJsonPath, $packageLockPath)) {
        if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
            throw "Required frontend file is missing: $requiredFile"
        }
    }

    try {
        $null = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
        $null = Get-Content -LiteralPath $packageLockPath -Raw | ConvertFrom-Json
    }
    catch {
        throw "frontend/package.json or frontend/package-lock.json is not valid JSON. Restore the repository files and try again."
    }

    $nodeInfo = Get-NodeInfo
    if ($null -eq $nodeInfo -or $nodeInfo.Version -lt $minimumNodeVersion) {
        if ($null -eq $nodeInfo) {
            Write-Host 'A compatible Node.js installation was not found.' -ForegroundColor Yellow
        }
        else {
            Write-Host ("Node.js {0} was found; Node.js {1} or newer is required." -f $nodeInfo.Text, $minimumNodeVersion) -ForegroundColor Yellow
        }

        Install-NodeLts
        Refresh-ProcessPath
        $nodeInfo = Get-NodeInfo
    }

    if ($null -eq $nodeInfo -or $nodeInfo.Version -lt $minimumNodeVersion) {
        throw "Node.js 22.12 or newer could not be found after installation. Install the official Node.js LTS from $nodeDownloadUrl, restart Windows if the installer requested it, and run Start-LuxeGlow.bat again."
    }

    $npmPath = Get-NpmPath
    if ($null -eq $npmPath) {
        throw "Node.js was found, but npm is unavailable. Install the official Node.js LTS from $nodeDownloadUrl and run Start-LuxeGlow.bat again."
    }

    $npmVersionText = (& $npmPath --version 2>&1 | Out-String).Trim()
    $npmExitCode = $LASTEXITCODE
    if ($npmExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($npmVersionText)) {
        throw "npm could not be started. Install the official Node.js LTS from $nodeDownloadUrl and run Start-LuxeGlow.bat again."
    }

    Write-Host ("Using Node.js {0} and npm {1}." -f $nodeInfo.Text, $npmVersionText) -ForegroundColor Green
    Write-Host 'Installing the exact frontend dependencies from package-lock.json (npm ci)...' -ForegroundColor Cyan
    Push-Location -LiteralPath $frontendRoot
    try {
        & $npmPath ci
        $npmCiExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($npmCiExitCode -ne 0) {
        throw "npm ci failed (exit code $npmCiExitCode). Check your internet connection and the npm output above, then run Start-LuxeGlow.bat again."
    }

    Write-Host 'Starting the Vite development server. Its logs will remain visible in this window.' -ForegroundColor Cyan
    $devProcess = Start-Process -FilePath $npmPath -ArgumentList @('run', 'dev', '--', '--host', 'localhost', '--strictPort') -WorkingDirectory $frontendRoot -NoNewWindow -PassThru
    $serverReady = $false

    for ($attempt = 1; $attempt -le 60; $attempt++) {
        if ($devProcess.HasExited) {
            throw "The Vite development server stopped before it became ready (exit code $($devProcess.ExitCode)). Check the server output above."
        }

        try {
            Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
            $serverReady = $true
            break
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $serverReady) {
        Write-Warning "The server was not confirmed within 30 seconds. Opening $serverUrl anyway; review the Vite logs if it does not load."
    }

    Start-Process -FilePath $serverUrl
    Write-Host "LuxeGlow is running at $serverUrl" -ForegroundColor Green
    Write-Host 'Keep this window open while using the app. Press Ctrl+C here to stop the Vite server.' -ForegroundColor DarkGray
    Wait-Process -Id $devProcess.Id
}
catch {
    Write-Host ''
    Write-Error $_.Exception.Message -ErrorAction Continue
    $scriptExitCode = 1
}
finally {
    if ($null -ne $devProcess -and -not $devProcess.HasExited) {
        Stop-Process -Id $devProcess.Id -ErrorAction SilentlyContinue
    }
}

exit $scriptExitCode
