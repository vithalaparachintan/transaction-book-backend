#!/bin/bash
# Quick Start Script for Payment System

echo "==============================================="
echo "Transaction Book - Payment System Quick Start"
echo "==============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js
echo -e "${YELLOW}[1/5] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version) found${NC}"

# Check MongoDB
echo ""
echo -e "${YELLOW}[2/5] Checking MongoDB...${NC}"
if mongosh --eval "db.version()" &> /dev/null; then
    echo -e "${GREEN}✅ MongoDB is running${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB might not be running${NC}"
    echo "    Start it with: mongod --dbpath /path/to/data"
fi

# Install backend dependencies
echo ""
echo -e "${YELLOW}[3/5] Installing backend dependencies...${NC}"
cd transaction-book-backend
if [ ! -d "node_modules" ]; then
    npm install > /dev/null 2>&1
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Backend dependencies already installed${NC}"
fi

# Run migration
echo ""
echo -e "${YELLOW}[4/5] Running database migration...${NC}"
node migrate-wallets.js > /dev/null 2>&1
echo -e "${GREEN}✅ Database migration completed${NC}"

# Start backend
echo ""
echo -e "${YELLOW}[5/5] Starting backend server...${NC}"
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "📝 Backend: http://localhost:5000"
echo -e "🔑 API: http://localhost:5000/api"
echo ""
echo -e "${YELLOW}Starting server... Press Ctrl+C to stop${NC}"
echo ""

npm start
