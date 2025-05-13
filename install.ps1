function Write-Log {
    param (
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "DEBUG")]
        [string]$Level = "INFO"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    switch ($Level) {
        "INFO" {
            $color = "Cyan"
            $label = "[INFO]"
        }
        "WARN" {
            $color = "Yellow"
            $label = "[WARN ]"
        }
        "ERROR" {
            $color = "Red"
            $label = "[ERROR]"
        }
        "DEBUG" {
            $color = "Gray"
            $label = "[DEBUG]"
        }
    }

    Write-Host "$timestamp $label $Message" -ForegroundColor $color
}


function Check-Python {
    Write-Log "Trying to locate a valid Python installation..." -Level INFO
    $output = python3 --version 2>&1

    if ($LASTEXITCODE -eq 0) {
        if ($output -match "Python (\d+\.\d+\.\d+)") {
            $version = $matches[1]
            
            if ([version]$version -lt [version]3.9) {
                Write-Log "Found non-matching python version" $version -Level DEBUG;
            }
            else {
                Write-Log "Found matching python3 version" -Level INFO;
                return "python3";
            }
        }
    }


    $output = python --version 2>&1

    if ($LASTEXITCODE -eq 0) {
        if ($output -match "Python (\d+\.\d+\.\d+)") {
            $version = $matches[1]
            
            if ([version]$version -lt [version]3.9) {
                Write-Log "Found non-matching python version" $version -Level DEBUG;
            }
            else {
                Write-Log "Found matching python version" -Level INFO;
                return "python";
            }
        }
    }
    Write-Log "Couldn't find a version" -Level ERROR;
    Write-Log "If you don't have python installed, you can install it from here. https://www.python.org/downloads/release/python-31210/" -Level INFO;
    Write-log "If you have python installed, please add it to your PATH. https://realpython.com/add-python-to-path/" -Level INFO;
    Exit;
}

$currentFolder = Split-Path -Leaf (Get-Location);

if ($currentFolder -ne "Vencord") {
    Write-Log "Please run this script in the Vencord folder!" -Level ERROR;
    Exit
}

$targetPython = Check-Python
$params = (" -m pip install -r {0}\src\userplugins\betterNotifications\server\requirements.txt" -f $(Get-Location));

$cmd = $targetPython + $params
Invoke-Expression $cmd

if ($LASTEXITCODE -ne 0) {
    Write-Log "pip install failed! Please see the log above." -Level ERROR:
    exit;
}
else {
    Write-Log "Succesfully installed dependencies." -Level INFO
}

$confirmation = Read-Host "Do you want to start the notification server on login? If you press n, you need to start up the server manually each time you reboot. [y/n]"
if ($confirmation -eq 'y') {
    $startCommand = "cd {0}\src\userplugins\betterNotifications\server && {1} main.py {2} pause" -f $(Get-Location), $targetPython, [Environment]::NewLine
    $file = "{0}\betterNotificationServer.bat" -f [Environment]::GetFolderPath("Startup") 

    if (Test-Path $file) {
        Remove-Item $file
    }

    New-Item $file -ItemType File -Value $startCommand;
    Write-Log "Added betterNotificationServer to shell:startup folder.";
}

