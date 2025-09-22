#!/bin/bash
# WSL2 Access URL Generator
# Provides current WSL2 IP addresses for Windows browser access

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🌐 WSL2 Development Server Access URLs${NC}"
echo "=============================================="

# Get WSL2 IP address
WSL_IP=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}📍 WSL2 IP Address: $WSL_IP${NC}"

echo ""
echo -e "${GREEN}🔗 Current Service URLs (for Windows browser):${NC}"

# Check active ports and generate URLs
echo -e "${YELLOW}Frontend (React):${NC}"
if ss -tln | grep -q ":3001 "; then
    echo -e "  ✅ http://$WSL_IP:3001"
else
    echo -e "  ❌ Frontend not running on port 3001"
fi

if ss -tln | grep -q ":3000 "; then
    echo -e "  ✅ http://$WSL_IP:3000 (alternative)"
fi

echo ""
echo -e "${YELLOW}Backend API:${NC}"
if ss -tln | grep -q ":8000 "; then
    echo -e "  ✅ http://$WSL_IP:8000/docs (API Documentation)"
    echo -e "  ✅ http://$WSL_IP:8000/redoc (Interactive API)"
fi

if ss -tln | grep -q ":8001 "; then
    echo -e "  ✅ http://$WSL_IP:8001/docs (alternative backend)"
fi

echo ""
echo -e "${BLUE}💡 Usage Notes:${NC}"
echo -e "${BLUE}   • Copy these URLs directly into your Windows browser${NC}"
echo -e "${BLUE}   • WSL2 IP may change after Windows reboot${NC}"
echo -e "${BLUE}   • Run this script anytime to get current URLs${NC}"

echo ""
echo -e "${GREEN}🚀 Quick Commands:${NC}"
echo -e "${GREEN}   Copy frontend URL: echo \"http://$WSL_IP:3001\" | clip.exe${NC}"
echo -e "${GREEN}   Copy backend URL:  echo \"http://$WSL_IP:8000/docs\" | clip.exe${NC}"