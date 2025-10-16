# Service Management for Private Markets Tracker

## Currently Running Services

You currently have 3 services running:

1. **Backend API** - Port 8000
   - Started manually in tmux/background
   - Process ID: Check with `ps aux | grep uvicorn`

2. **Frontend React** - Port 3000
   - Started manually in tmux/background
   - Process ID: Check with `ps aux | grep "npm start"`

3. **Database Viewer** - Port 5001 (NEW!)
   - Started manually in background
   - Process ID: Check with `ps aux | grep db_viewer`

## Quick Commands

### Check what's running:
```bash
ps aux | grep -E "uvicorn|db_viewer|npm start"
```

### Start Database Viewer only:
```bash
cd /home/will/Tmux-Orchestrator/private-markets-tracker
source venv/bin/activate
python db_viewer.py
```

### Start everything together:
```bash
cd /home/will/Tmux-Orchestrator/private-markets-tracker
./start_all.sh
```

## URLs

- Backend API: http://172.23.5.82:8000
- Backend Docs: http://172.23.5.82:8000/docs
- Frontend App: http://172.23.5.82:3000
- Database Viewer: http://172.23.5.82:5001

## Current Answer to Your Question

**Q: Will Database Viewer always be available on port 5001 while backend is running?**

**A: Currently NO** - they are separate processes. The database viewer will keep running until:
- You stop it manually
- The terminal closes
- System restarts

**To make it permanent**, you have these options:

1. **Add to your tmux startup** - Start it in a dedicated tmux window
2. **Use systemd service** - Make it a system service that auto-starts
3. **Add to start_all.sh** - Start both together every time
4. **Run in screen/tmux** - Keep it running in background persistently

## Recommendation

Since you're using tmux orchestration, I recommend creating a dedicated tmux window for the database viewer. That way it:
- ✓ Starts with your other services
- ✓ Persists across terminal sessions
- ✓ Easy to monitor/restart
- ✓ Consistent with your workflow

Would you like me to add it to your tmux setup?
