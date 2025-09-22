#!/bin/bash
# WSL2-Optimized tmux Session Setup for Private Markets Tracker
# Creates organized development environment with proper Windows integration

SESSION_NAME="private-markets"
PROJECT_ROOT="/home/will/Tmux-Orchestrator/private-markets-tracker"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🖥️  Setting up tmux development session: $SESSION_NAME${NC}"

# Kill existing session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

# Create new session
echo -e "${BLUE}📁 Creating tmux session in: $PROJECT_ROOT${NC}"
tmux new-session -d -s $SESSION_NAME -c "$PROJECT_ROOT"

# Window 0: Backend API
tmux rename-window -t $SESSION_NAME:0 "Backend-API"
tmux split-window -t $SESSION_NAME:0 -h -c "$PROJECT_ROOT"
tmux send-keys -t $SESSION_NAME:0.0 "source venv/bin/activate" Enter
tmux send-keys -t $SESSION_NAME:0.0 "echo 'Backend ready. Use: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000'" Enter
tmux send-keys -t $SESSION_NAME:0.1 "echo 'Backend monitoring pane'" Enter
tmux send-keys -t $SESSION_NAME:0.1 "watch -n 2 'ss -tlnp | grep -E \":800[0-9].*LISTEN\"'" Enter

# Window 1: Frontend Development
tmux new-window -t $SESSION_NAME -n "Frontend-Dev" -c "$PROJECT_ROOT/frontend"
tmux send-keys -t $SESSION_NAME:1 "echo 'Frontend ready. Use: npm start'" Enter

# Window 2: Database Management
tmux new-window -t $SESSION_NAME -n "Database" -c "$PROJECT_ROOT"
tmux send-keys -t $SESSION_NAME:2 "echo 'Database management window'" Enter
tmux send-keys -t $SESSION_NAME:2 "echo 'SQLite: ./portfolio_tracker.db'" Enter
tmux send-keys -t $SESSION_NAME:2 "echo 'Migration: python migrate_to_postgresql.py'" Enter

# Window 3: Utilities & Monitoring
tmux new-window -t $SESSION_NAME -n "Utils" -c "$PROJECT_ROOT"
tmux split-window -t $SESSION_NAME:3 -h -c "$PROJECT_ROOT"
tmux send-keys -t $SESSION_NAME:3.0 "echo 'Utility shell - Git, files, testing'" Enter
tmux send-keys -t $SESSION_NAME:3.1 "echo 'Network monitoring'" Enter
tmux send-keys -t $SESSION_NAME:3.1 "watch -n 5 'echo \"=== Active Development Servers ===\" && ss -tlnp | grep -E \":(3000|3001|8000|8001).*LISTEN\"'" Enter

# Window 4: Development Scripts
tmux new-window -t $SESSION_NAME -n "Scripts" -c "$PROJECT_ROOT"
tmux send-keys -t $SESSION_NAME:4 "echo 'Development automation scripts'" Enter
tmux send-keys -t $SESSION_NAME:4 "echo 'Available scripts:'" Enter
tmux send-keys -t $SESSION_NAME:4 "echo '  ./dev-start.sh - Start full development environment'" Enter
tmux send-keys -t $SESSION_NAME:4 "echo '  ./tmux-setup.sh - Recreate this tmux session'" Enter
tmux send-keys -t $SESSION_NAME:4 "ls -la *.sh" Enter

# Set default window
tmux select-window -t $SESSION_NAME:0
tmux select-pane -t $SESSION_NAME:0.0

echo -e "${GREEN}✅ tmux session '$SESSION_NAME' created successfully!${NC}"
echo -e "${BLUE}📋 Window Layout:${NC}"
echo -e "${BLUE}   0: Backend-API (split: development | monitoring)${NC}"
echo -e "${BLUE}   1: Frontend-Dev${NC}"
echo -e "${BLUE}   2: Database${NC}"
echo -e "${BLUE}   3: Utils (split: shell | network monitoring)${NC}"
echo -e "${BLUE}   4: Scripts${NC}"
echo ""
echo -e "${YELLOW}🔗 To attach to session:${NC}"
echo -e "${YELLOW}   tmux attach-session -t $SESSION_NAME${NC}"
echo ""
echo -e "${YELLOW}💡 Quick tmux commands:${NC}"
echo -e "${YELLOW}   Ctrl+B, 0-4  - Switch between windows${NC}"
echo -e "${YELLOW}   Ctrl+B, →/←  - Switch between panes${NC}"
echo -e "${YELLOW}   Ctrl+B, d    - Detach from session${NC}"