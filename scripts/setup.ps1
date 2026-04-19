param(
  [string]$Vault,
  [switch]$SkipObsidian
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

$ArgsList = @()
if ($Vault) {
  $ArgsList += "--vault"
  $ArgsList += $Vault
}
if ($SkipObsidian) {
  $ArgsList += "--skip-obsidian"
}

node scripts/setup.mjs @ArgsList
