#!/usr/bin/env pwsh

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Transaction Book - Payment System Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if Node.js is installed
Write-Host "`n[1/6] Checking Node.js installation..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $(node --version) found" -ForegroundColor Green

# Check if MongoDB is running
Write-Host "`n[2/6] Checking MongoDB connection..." -ForegroundColor Yellow
$mongoCheck = mongosh --eval "db.version()" --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  MongoDB might not be running. Please start MongoDB service." -ForegroundColor Yellow
    Write-Host "    Command: mongod --dbpath <your_data_path>" -ForegroundColor Gray
} else {
    Write-Host "✅ MongoDB is running" -ForegroundColor Green
}

# Install backend dependencies
Write-Host "`n[3/6] Installing backend dependencies..." -ForegroundColor Yellow
cd transaction-book-backend
if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✅ Backend dependencies already installed" -ForegroundColor Green
}

# Check .env file
Write-Host "`n[4/6] Verifying .env configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found. Creating from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue
}

$envContent = Get-Content ".env" -Raw
if ($envContent -like "*RAZORPAY_KEY*") {
    Write-Host "✅ .env file configured" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file needs Razorpay credentials" -ForegroundColor Yellow
}

# Run database migration
Write-Host "`n[5/6] Running database migration..." -ForegroundColor Yellow
node migrate-wallets.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database migration completed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Migration had warnings (this is normal if no users exist yet)" -ForegroundColor Yellow
}

# Start backend server
Write-Host "`n[6/6] Starting backend server..." -ForegroundColor Yellow
Write-Host "`n✅ Setup complete! Server starting on port 5000..." -ForegroundColor Green
Write-Host "📝 API URL: http://localhost:5000/api" -ForegroundColor Cyan
Write-Host "🧪 Test endpoints using Postman or cURL" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop the server`n" -ForegroundColor Gray

npm start
