# Windows Deployment Guide - Private Markets Portfolio Tracker Enhanced

## 📦 **Package Contents**
**File**: `private-markets-tracker-enhanced.tar.gz` (853KB)

### ✅ **What's Included**
- **Enhanced Basic Auditing System** - Complete user tracking for all data changes
- **12-Month Liquidity Forecast Dashboard** - Advanced cash flow forecasting with override capabilities
- **Entity Management System** - Complete entity hierarchy and relationship management
- **Professional Investment Tracking** - 22+ fields, 4-tab modal, Excel templates
- **Performance Analytics** - IRR/TVPI calculations with benchmarking
- **Cash Flow Calendar** - Visual cash flow management
- **Document Management** - Upload and categorization system

### ✅ **Latest Features (Just Added)**
- **Forecast Override System** - Add known/confirmed cash flows while preserving assumptions
- **Liquidity Alerts** - Early warning system for cash shortfalls
- **Stress Testing** - Model accelerated calls and delayed distributions
- **Cash Flow Matching** - Optimize liquidity through distribution/call alignment

---

## 🚀 **Windows Installation Steps**

### **Step 1: Extract Package**
```bash
# Extract the tar.gz file using Windows tools or:
# - 7-Zip (recommended)
# - WinRAR
# - Windows built-in tar command (Windows 10+)

# If using Windows command line:
tar -xzf private-markets-tracker-enhanced.tar.gz
```

### **Step 2: Install Dependencies**

#### **Backend (Python)**
```bash
# Navigate to project directory
cd private-markets-tracker

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

#### **Frontend (Node.js)**
```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install
```

### **Step 3: Database Setup**
```bash
# Return to project root
cd ..

# Run all migrations (from project root)
python migration_audit_fields.py
python migration_liquidity_forecast.py

# Optional: Seed with sample data
python app/benchmark_seeder.py
```

### **Step 4: Start Application**

#### **Terminal 1: Backend Server**
```bash
# Activate virtual environment
venv\Scripts\activate

# Start FastAPI server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### **Terminal 2: Frontend Server**
```bash
# Navigate to frontend
cd frontend

# Start React development server
npm start
```

### **Step 5: Access Application**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

---

## 🔧 **System Requirements**

### **Software Prerequisites**
- **Python 3.8+** (3.12 recommended)
- **Node.js 16+** (18+ recommended)
- **npm 8+** or yarn
- **Web browser** (Chrome, Firefox, Safari, Edge)

### **Hardware Recommendations**
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **CPU**: Modern dual-core processor
- **Network**: Internet connection for initial npm install

---

## 🎯 **Default Login Credentials**
- **Username**: `admin`
- **Password**: `password`

**⚠️ IMPORTANT**: Change these credentials before production use!

---

## 📋 **Feature Testing Checklist**

### **Basic Functionality** ✅
- [ ] Login with admin/password
- [ ] Navigate to Holdings tab - view existing investments
- [ ] Add new investment using 4-tab modal
- [ ] Add cash flows and valuations
- [ ] View performance calculations (IRR/TVPI)

### **Entity Management** ✅
- [ ] Navigate to Entity Management tab
- [ ] Create new entity (Family Office, Trust, LLC)
- [ ] Add family members to entities
- [ ] Create entity relationships (parent/subsidiary)
- [ ] View entity hierarchy visualization

### **NEW: Liquidity Forecast Dashboard** ✅
- [ ] Navigate to **"Liquidity Forecast"** tab
- [ ] View 12-month cash flow forecast chart
- [ ] Review monthly breakdown table
- [ ] Check liquidity alerts (if any)
- [ ] **Test Override System**:
  - [ ] Click "Add Override" on any month
  - [ ] Add confirmed capital call or distribution
  - [ ] See override indicator (*) in table
  - [ ] Verify forecast updates with known amounts

### **Advanced Features** ✅
- [ ] Navigate to Visuals & Analytics - see portfolio charts
- [ ] Navigate to Cash Flow Calendar - view monthly activity
- [ ] Navigate to Documents - upload and manage files
- [ ] Test Excel template downloads (Investment Import)

### **NEW: Audit System** ✅
- [ ] Make changes to investments, entities, or cash flows
- [ ] Check backend logs for user tracking
- [ ] Test audit API endpoints: `/api/audit/status`

---

## 🔍 **Troubleshooting**

### **Common Issues**

#### **"Module not found" Python Errors**
```bash
# Ensure virtual environment is activated
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

#### **"ENOENT" or npm Errors**
```bash
# Clear npm cache and reinstall
cd frontend
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### **Database Issues**
```bash
# If migrations fail, check if sqlite3 is available
python -c "import sqlite3; print('SQLite OK')"

# If database gets corrupted, remove and recreate
rm portfolio.db
python migration_audit_fields.py
python migration_liquidity_forecast.py
```

#### **Port Conflicts**
- **Backend Port 8000 in use**: Change to `--port 8001` in uvicorn command
- **Frontend Port 3000 in use**: React will automatically suggest port 3001

### **Performance Notes**
- **First npm install**: May take 5-10 minutes depending on internet speed
- **Database migrations**: Should complete in seconds
- **Application startup**: Backend ~3 seconds, Frontend ~30 seconds

---

## 📊 **What's New in This Version**

### **🆕 12-Month Liquidity Forecast Dashboard**
- **Professional cash flow forecasting** with 12-month visibility
- **Override system** for incorporating known/confirmed events
- **Liquidity alerts** and risk management
- **Stress testing** scenarios
- **Cash flow matching** optimization

### **🆕 Enhanced Basic Auditing System**
- **Complete user tracking** for all data modifications
- **Audit trail** for compliance and data quality
- **"Who changed what when"** visibility
- **Regulatory compliance** features

### **🔧 Previous Enhancements Included**
- **4-tab investment modal** with 22+ institutional fields
- **Entity relationship management** with hierarchy visualization
- **Excel template system** for bulk imports
- **Advanced performance calculations** (IRR/TVPI with institutional-grade accuracy)
- **Cash flow calendar** with visual monthly overview
- **Document management** with categorization

---

## ✅ **Deployment Checklist**

### **Pre-Testing**
- [ ] Download `private-markets-tracker-enhanced.tar.gz`
- [ ] Extract to preferred Windows directory
- [ ] Verify Python 3.8+ and Node.js 16+ installed

### **Installation**
- [ ] Create and activate Python virtual environment  
- [ ] Install Python dependencies (`pip install -r requirements.txt`)
- [ ] Install Node.js dependencies (`cd frontend && npm install`)
- [ ] Run database migrations

### **Testing**
- [ ] Start backend server (uvicorn command)
- [ ] Start frontend server (npm start)
- [ ] Test login (admin/password)
- [ ] Verify all tabs load correctly
- [ ] **Test new Liquidity Forecast dashboard**
- [ ] **Test override functionality**

### **Production Preparation**
- [ ] Change default admin password
- [ ] Configure production database (PostgreSQL recommended)
- [ ] Set up SSL certificates
- [ ] Configure backup strategy

---

## 🎉 **Ready for Download**

**Package**: `deployment/private-markets-tracker-enhanced.tar.gz`  
**Size**: 853KB  
**Contents**: Complete enhanced application with all latest features  
**Status**: ✅ **Ready for Windows deployment and testing**

---

*Enhanced Private Markets Portfolio Tracker v2.0*  
*Package Date: August 29, 2025*  
*Includes: Liquidity Forecast Dashboard + Enhanced Auditing + Entity Management*