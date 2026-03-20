# Generates a BCrypt hash using BCrypt.Net-Next from the project's NuGet cache
# Usage: .\generate_bcrypt_hash.ps1
# Then copy the hash into 004_seed_demo_users.sql

$password = "Stockwell@2026"

# Find BCrypt.Net-Next in the NuGet packages cache
$nugetPaths = @(
    "$env:USERPROFILE\.nuget\packages\bcrypt.net-next",
    "C:\Users\$env:USERNAME\.nuget\packages\bcrypt.net-next"
)

$bcryptDll = $null
foreach ($path in $nugetPaths) {
    if (Test-Path $path) {
        $bcryptDll = Get-ChildItem -Path $path -Recurse -Filter "BCrypt.Net.dll" |
            Where-Object { $_.FullName -match "net6|net7|net8|netstandard2" } |
            Select-Object -First 1 -ExpandProperty FullName
        if ($bcryptDll) { break }
    }
}

if (-not $bcryptDll) {
    # Try finding it next to the backend project
    $solutionRoot = Split-Path $PSScriptRoot
    $bcryptDll = Get-ChildItem -Path "$solutionRoot\backend" -Recurse -Filter "BCrypt.Net.dll" -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}

if (-not $bcryptDll) {
    Write-Error "BCrypt.Net.dll not found. Make sure you have run 'dotnet restore' on the backend project."
    exit 1
}

Add-Type -Path $bcryptDll
$hash = [BCrypt.Net.BCrypt]::HashPassword($password, 11)
Write-Host ""
Write-Host "Password : $password"
Write-Host "BCrypt   : $hash"
Write-Host ""
Write-Host "Replace the @pw value in 004_seed_demo_users.sql with the hash above."
