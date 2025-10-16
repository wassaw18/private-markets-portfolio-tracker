#!/bin/bash
# Start all services for Private Markets Tracker

echo "Starting Private Markets Tracker Services..."
echo "=============================================="

# Start backend API
echo "Starting Backend API on port 8000..."
source venv/bin/activate && uvicorn app.main_tenant:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "✓ Backend API started (PID: $BACKEND_PID)"

# Start database viewer
echo "Starting Database Viewer on port 5001..."
source venv/bin/activate && python db_viewer.py &
DB_VIEWER_PID=$!
echo "✓ Database Viewer started (PID: $DB_VIEWER_PID)"

# Start frontend (if you want)
# echo "Starting Frontend on port 3000..."
# cd frontend && HOST=172.23.5.82 PORT=3000 npm start &
# FRONTEND_PID=$!
# echo "✓ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "=============================================="
echo "All services started!"
echo "=============================================="
echo "Backend API:       http://172.23.5.82:8000"
echo "Database Viewer:   http://172.23.5.82:5001"
# echo "Frontend:          http://172.23.5.82:3000"
echo "=============================================="
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $DB_VIEWER_PID; exit" INT
wait
