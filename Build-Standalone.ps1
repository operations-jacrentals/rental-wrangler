# =============================================================================
# Build-Standalone.ps1 - bundles the whole Rental Wrangler app into ONE file:
#   JacTec-standalone.html   (double-click to open; no server, works offline*)
#
# Re-run this anytime to refresh the standalone from the current source files:
#   right-click > "Run with PowerShell", or in a terminal:  .\Build-Standalone.ps1
#
# How it works: each ES module (config/data/cascade/service-countdown) is embedded
# as a data: URL and wired through an import map, so every module keeps its own
# scope (no name collisions) and the file runs straight from file:// .
# *Offline except the Google "Geist" web font + the QR image service (cosmetic).
# =============================================================================
$ErrorActionPreference = 'Stop'
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

function ReadFile($p) { return [IO.File]::ReadAllText((Join-Path $root $p), [Text.Encoding]::UTF8) }
function DataUrl($s) { return 'data:text/javascript;base64,' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)) }

$css     = ReadFile 'style.css'
$config  = ReadFile 'config.js'
$data    = ReadFile 'data.js'
$cascade = ReadFile 'cascade.js'
$service = ReadFile 'service-countdown.js'
$app     = ReadFile 'app.js'

# Point app.js's module imports at bare specifiers that the import map resolves.
$app = $app.Replace("from './config.js'",  "from 'jactec-config'")
$app = $app.Replace("from './data.js'",     "from 'jactec-data'")
$app = $app.Replace("from './cascade.js'",  "from 'jactec-cascade'")
$app = $app.Replace("from './service-countdown.js'", "from 'jactec-service'")

$importmap = @{ imports = @{
    'jactec-config'  = (DataUrl $config)
    'jactec-data'    = (DataUrl $data)
    'jactec-cascade' = (DataUrl $cascade)
    'jactec-service' = (DataUrl $service)
} } | ConvertTo-Json -Compress

$appUrl = DataUrl $app

$html = @"
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1180" />
<title>Rental Wrangler - JacTec (standalone)</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
$css
</style>
</head>
<body>
<div id="app"></div>
<div id="overlay-root"></div>
<div id="toast" class="toast"></div>
<script type="importmap">
$importmap
</script>
<script type="module" src="$appUrl"></script>
</body>
</html>
"@

$out = Join-Path $root 'JacTec-standalone.html'
[IO.File]::WriteAllText($out, $html, (New-Object Text.UTF8Encoding $false))
$kb = [math]::Round((Get-Item $out).Length / 1KB)
Write-Host "Built JacTec-standalone.html ($kb KB) - double-click it to open the app." -ForegroundColor Green
