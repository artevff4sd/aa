Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "     Pepe Star - Setup Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "Node.js not found. Attempting to install via winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS -e
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
Write-Host "Installing dependencies..." -ForegroundColor Green
npm install
Write-Host "Pushing database schema..." -ForegroundColor Green
npx drizzle-kit push
Write-Host "Starting development server..." -ForegroundColor Green
npm run dev
