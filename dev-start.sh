#!/bin/bash
# WSL2-Optimized Development Environment Startup Script
# Private Markets Tracker - Full Stack Development

set -e

echo "🚀 Starting Private Markets Tracker Development Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="/home/will/Tmux-Orchestrator/private-markets-tracker"
cd "$PROJECT_ROOT"

# Function to check if port is in use
check_port() {
    local port=$1
    if ss -tlnp | grep -q ":$port.*LISTEN"; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        return 0
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
        return 1
    fi
}

# Function to start backend
start_backend() {
    echo -e "${BLUE}🔧 Starting Backend API...${NC}"

    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        echo -e "${RED}❌ Virtual environment not found. Creating...${NC}"
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    else
        source venv/bin/activate
    fi

    # Find available port
    BACKEND_PORT=8000
    if check_port $BACKEND_PORT; then
        BACKEND_PORT=8001
        if check_port $BACKEND_PORT; then
            BACKEND_PORT=8002
        fi
    fi

    echo -e "${GREEN}🚀 Starting backend on port $BACKEND_PORT${NC}"
    echo -e "${BLUE}📡 Backend will be accessible from Windows at: http://localhost:$BACKEND_PORT${NC}"
    echo -e "${BLUE}📖 API Documentation: http://localhost:$BACKEND_PORT/docs${NC}"

    # Start with WSL2-optimized settings
    uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT &
    BACKEND_PID=$!

    # Wait for backend to start
    sleep 3
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Backend started successfully (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}❌ Backend failed to start${NC}"
        exit 1
    fi
}

# Function to start frontend
start_frontend() {
    echo -e "${BLUE}🎨 Starting Frontend Development Server...${NC}"

    cd frontend

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        npm install
    fi

    # Find available port
    FRONTEND_PORT=3000
    if check_port $FRONTEND_PORT; then
        FRONTEND_PORT=3001
        if check_port $FRONTEND_PORT; then
            FRONTEND_PORT=3002
        fi
    fi

    echo -e "${GREEN}🚀 Starting frontend on port $FRONTEND_PORT${NC}"
    echo -e "${BLUE}🌐 Frontend will be accessible from Windows at: http://localhost:$FRONTEND_PORT${NC}"

    # Set port explicitly and start
    PORT=$FRONTEND_PORT npm start &
    FRONTEND_PID=$!

    cd ..

    # Wait for frontend to start
    sleep 5
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Frontend started successfully (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}❌ Frontend failed to start${NC}"
        exit 1
    fi
}

# Function to check WSL2 networking
check_wsl2_network() {
    echo -e "${BLUE}🔍 Checking WSL2 Network Configuration...${NC}"

    # Get WSL2 IP address
    WSL_IP=$(hostname -I | awk '{print $1}')
    echo -e "${BLUE}📍 WSL2 IP Address: $WSL_IP${NC}"

    # Check if Windows can access WSL2 services
    echo -e "${BLUE}🌐 WSL2 services are accessible from Windows via localhost${NC}"
    echo -e "${BLUE}   - Backend API: http://localhost:$BACKEND_PORT${NC}"
    echo -e "${BLUE}   - Frontend App: http://localhost:$FRONTEND_PORT${NC}"
    echo -e "${BLUE}   - Alternative access via WSL IP: http://$WSL_IP:$BACKEND_PORT${NC}"
}

# Main execution
main() {
    echo -e "${YELLOW}🏗️  Setting up development environment...${NC}"

    # Check if we're in WSL2
    if grep -q "microsoft" /proc/version; then
        echo -e "${GREEN}✅ Running in WSL2 environment${NC}"
    else
        echo -e "${YELLOW}⚠️  Not running in WSL2 - some features may not work optimally${NC}"
    fi

    # Kill any existing development servers
    echo -e "${BLUE}🧹 Cleaning up existing processes...${NC}"
    pkill -f "uvicorn.*app.main" 2>/dev/null || true
    pkill -f "react-scripts start" 2>/dev/null || true
    sleep 2

    # Start services
    start_backend
    start_frontend
    check_wsl2_network

    echo ""
    echo -e "${GREEN}🎉 Development environment is ready!${NC}"
    echo -e "${GREEN}=================================${NC}"
    echo -e "${BLUE}🔗 Quick Links (accessible from Windows):${NC}"
    echo -e "${BLUE}   • Frontend Application: http://localhost:$FRONTEND_PORT${NC}"
    echo -e "${BLUE}   • Backend API: http://localhost:$BACKEND_PORT${NC}"
    echo -e "${BLUE}   • API Documentation: http://localhost:$BACKEND_PORT/docs${NC}"
    echo -e "${BLUE}   • Interactive API: http://localhost:$BACKEND_PORT/redoc${NC}"
    echo ""
    echo -e "${YELLOW}💡 Tips:${NC}"
    echo -e "${YELLOW}   • File changes will auto-reload both frontend and backend${NC}"
    echo -e "${YELLOW}   • Use tmux session 'private-markets' for organized development${NC}"
    echo -e "${YELLOW}   • Backend logs: tail -f backend.log${NC}"
    echo -e "${YELLOW}   • Kill servers: pkill -f 'uvicorn\\|react-scripts'${NC}"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
}

# Run main function
main "$@"