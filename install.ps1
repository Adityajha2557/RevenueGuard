# RevenueGuard AI — full setup script
# Run this from the RevenueGuard root folder:
#   .\install.ps1

Write-Host "=== Installing backend dependencies (Node/npm) ===" -ForegroundColor Cyan
Set-Location backend
npm install
Set-Location ..

Write-Host ""
Write-Host "=== Installing frontend dependencies (Node/npm) ===" -ForegroundColor Cyan
if (Test-Path frontend) {
    Set-Location frontend
    npm install
    Set-Location ..
} else {
    Write-Host "  (skipped — no 'frontend' folder found)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Installing dashboard dependencies (Python/pip) ===" -ForegroundColor Cyan
if (Test-Path dashboard) {
    Set-Location dashboard
    pip install -r requirements.txt
    Set-Location ..
} else {
    Write-Host "  (skipped — no 'dashboard' folder found)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "  1. Create backend\.env from backend\.env.example and add your GEMINI_API_KEY"
Write-Host "  2. cd backend; npm run dev"
Write-Host "  3. (optional) cd dashboard; streamlit run app.py"
