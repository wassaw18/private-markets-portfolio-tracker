# Private Markets Tracker - Quick Start Guide

## Starting All Services

Run this command to start everything at once:

```bash
./dev-start.sh
```

This will automatically start:
1. ✅ Backend API (port 8000)
2. ✅ Database Viewer (port 5001) - **NEW!**
3. ✅ Frontend App (port 3000)

## Access Your Services

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend App** | http://localhost:3000 | Main application interface |
| **Backend API** | http://localhost:8000 | REST API endpoints |
| **API Docs** | http://localhost:8000/docs | Interactive API documentation |
| **Database Viewer** | http://localhost:5001 | Browse & query PostgreSQL database |

## Database Viewer Features

The new Database Viewer at port 5001 provides:

- 📊 **Browse all tables** - Click any table to view its data
- 🔍 **Custom SQL queries** - Run any SQL query with a simple interface
- 📝 **Example queries** - Pre-made queries for common tasks
- 🎨 **Clean interface** - Easy to read, color-coded results
- ⚡ **Lightweight** - Only 41 MB RAM, minimal CPU usage

### Quick Queries You Can Try:

```sql
-- See all tenants
SELECT name, account_type FROM tenants;

-- See users with their organizations
SELECT u.username, u.email, t.name as org, u.role
FROM users u
JOIN tenants t ON u.tenant_id = t.id;

-- Count investments by tenant
SELECT t.name, COUNT(i.id) as investments
FROM tenants t
LEFT JOIN investments i ON i.tenant_id = t.id
GROUP BY t.name;
```

## Stopping Services

To stop all services:

```bash
pkill -f 'uvicorn\|react-scripts\|db_viewer'
```

Or stop them individually:

```bash
# Stop backend only
pkill -f "uvicorn.*app.main"

# Stop frontend only
pkill -f "react-scripts start"

# Stop database viewer only
pkill -f "db_viewer.py"
```

## Resource Usage

All services are very lightweight:

| Service | RAM | CPU (idle) |
|---------|-----|------------|
| Backend API | 31 MB | ~0% |
| Database Viewer | 41 MB | ~1.5% |
| Frontend | ~200 MB | ~0% |
| **Total** | ~272 MB | ~1.5% |

## Troubleshooting

### Port Already in Use

The `dev-start.sh` script automatically finds available ports:
- Backend: tries 8000, then 8001, then 8002
- Frontend: tries 3000, then 3001, then 3002
- Database Viewer: tries 5001, then 5002, then 5003

### Database Viewer Not Starting

Check that Flask is installed:
```bash
source venv/bin/activate
pip install flask
```

### Check What's Running

```bash
ps aux | grep -E "uvicorn|db_viewer|npm start"
```

## Next Steps

1. ✅ Services are running
2. ✅ Database Viewer is accessible at http://localhost:5001
3. ✅ Start developing!

Happy coding! 🚀
