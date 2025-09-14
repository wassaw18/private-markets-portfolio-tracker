# Private Markets Portfolio Tracker

A comprehensive, institutional-grade portfolio management system designed for family offices and private markets investors. Built with React (TypeScript) frontend and FastAPI (Python) backend.

## 🎯 **Key Features**

### **📊 Investment Management & Performance**
- **Professional Investment Dashboard** with clean, family-office-grade UI design  
- **True Portfolio-Level IRR Calculations** using aggregated cash flows and Newton-Raphson method
- **Enhanced Performance Metrics** (IRR, TVPI, DPI, RVPI) with accurate calculations
- **12-Month NAV Window** for current portfolio valuation (industry-standard approach)
- **Portfolio Summary Dashboard** with total portfolio value, performance metrics, and portfolio overview
- **Individual Investment Pages** with detailed cash flow, NAV, and performance tracking
- **Professional Investment Modal** with comprehensive investment data entry

### **💰 Cash Flow & Valuation Management** 
- **Complete Cash Flow Tracking** supporting negative amounts (capital calls vs distributions)
- **Multi-Type Cash Flows**: Capital Calls, Distributions, Fees, Yield, Return of Principal
- **NAV/Valuation Management** with date-based tracking and 12-month current windows
- **Automated Performance Calculations** based on real cash flow data
- **Cash Flow Calendar Integration** for timeline visibility
- **CRUD Operations** for editing and updating cash flow data

### **📋 Data Management & Import/Export**
- **Professional Excel Template System** for bulk data imports
- **Investment Bulk Upload** with comprehensive field validation  
- **Entity Bulk Upload** with conditional validation
- **NAV Bulk Upload** with investment dropdown validation
- **Cash Flow Bulk Upload** with type and investment validation
- **Template Download System** with pre-configured Excel templates
- **Error Handling & Validation** with detailed user feedback

### **🏢 Entity & Ownership Management**
- **Entity Management System** supporting Family Office, Trust, LLC, Partnership structures
- **Family Member Management** with relationship tracking and contact information
- **Investment Ownership Assignment** linking investments to entities
- **Entity Relationship Visualization** with interactive network diagrams
- **Entity Hierarchy Support** with parent/subsidiary relationships

### **📈 Analytics & Visualization**
- **Portfolio Performance Dashboard** with key metrics visualization
- **Asset Class Allocation Charts** with interactive breakdowns
- **Vintage Year Analysis** with portfolio diversification insights  
- **Commitment vs Called Analysis** showing capital deployment efficiency
- **J-Curve Visualization** for portfolio performance over time
- **Portfolio Timeline Charts** showing value progression

### **📄 Document Management**
- **Secure Document Upload System** with drag-and-drop interface
- **Document Categorization** with Investment Reports, Legal Documents, etc.
- **Document Status Tracking** (Pending, Received, Processed, Archived)
- **Document Search and Filtering** with advanced filter options
- **Investment-Linked Documents** for organized document management

## 🚀 **Quick Start**

### **Prerequisites**
- Python 3.8+ (3.12 recommended)
- Node.js 16+ (18+ recommended)  
- npm 8+ or yarn

### **Installation**

#### **1. Clone Repository**
```bash
git clone <your-repo-url>
cd private-markets-tracker
```

#### **2. Backend Setup**
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### **3. Frontend Setup**
```bash
cd frontend
npm install
```

#### **4. Start Application**
```bash
# Terminal 1: Backend (from project root)
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend (from frontend/ directory)
cd frontend
npm start
```

#### **5. Access Application**
- **Application**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs  
- **Default Login**: admin / password

## 📁 **Project Structure**

```
private-markets-tracker/
├── README.md                     # This file
├── requirements.txt              # Python dependencies  
├── portfolio_tracker.db         # SQLite database (created on first run)
├── app/                          # FastAPI Backend
│   ├── main.py                   # API endpoints and application setup
│   ├── models.py                 # SQLAlchemy database models
│   ├── schemas.py                # Pydantic request/response schemas  
│   ├── crud.py                   # Database operations
│   ├── database.py               # Database configuration
│   ├── performance.py            # Portfolio performance calculations
│   ├── excel_template_service.py # Excel template & bulk upload system
│   ├── entity_relationships.py   # Entity hierarchy management
│   ├── document_service.py       # Document management system
│   ├── calendar_service.py       # Cash flow calendar functionality
│   ├── dashboard.py              # Dashboard analytics
│   └── benchmark_service.py      # Benchmark data management
├── frontend/                     # React TypeScript Frontend
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── PortfolioSummary.tsx      # Main portfolio dashboard
│   │   │   ├── EnhancedInvestmentsTable.tsx  # Investment list view
│   │   │   ├── AddInvestmentModal.tsx    # Professional investment form
│   │   │   ├── CashFlowSection.tsx       # Cash flow management
│   │   │   ├── ValuationSection.tsx      # NAV management
│   │   │   ├── PerformanceMetrics.tsx    # Performance analytics
│   │   │   ├── EntityManagement.tsx     # Entity management
│   │   │   └── [60+ other components]
│   │   ├── pages/                # Page-level components
│   │   │   ├── Holdings.tsx      # Main holdings page
│   │   │   ├── InvestmentDetails.tsx  # Individual investment view
│   │   │   ├── BulkUpload.tsx    # Bulk import interface
│   │   │   ├── Entities.tsx      # Entity management page
│   │   │   ├── Documents.tsx     # Document management
│   │   │   └── Visuals.tsx       # Analytics dashboard
│   │   ├── services/             # API service layer
│   │   ├── types/                # TypeScript type definitions
│   │   └── contexts/             # React contexts (Auth, etc.)
│   └── package.json              # Node.js dependencies
├── tests/                        # Test files  
├── sample-data/                  # Sample data for testing
├── docs/                         # Documentation
├── uploads/                      # Document upload directory
└── venv/                         # Python virtual environment
```

## 🔧 **Architecture**

### **Backend (FastAPI + SQLAlchemy)**
- **RESTful API** with automatic OpenAPI documentation at `/docs`
- **SQLite Database** with comprehensive schema for private markets data
- **Pydantic Validation** for type safety and data integrity  
- **Advanced Performance Calculations** with true portfolio-level IRR
- **Bulk Upload System** with Excel template generation and validation
- **Entity Relationship Management** with complex hierarchy support

### **Frontend (React + TypeScript)** 
- **Modern React** with hooks and functional components
- **TypeScript** for type safety and enhanced developer experience
- **Professional UI Design** optimized for family office workflows
- **Recharts Integration** for financial data visualizations
- **Responsive Design** with CSS Grid and Flexbox
- **Context-Based State Management** for user authentication and global state

### **Key Architectural Decisions**
- **API-First Design**: Clear separation between frontend and backend
- **True Portfolio Performance**: Aggregated cash flow calculations vs weighted averages  
- **Family Office Optimized**: UI and workflows designed for institutional users
- **Validation-First Approach**: Comprehensive input validation for data integrity
- **Professional Grade**: Enterprise-ready with proper error handling

## 📊 **Core Capabilities**

### **Investment Performance**
- **True IRR Calculation**: Portfolio-level IRR using aggregated cash flows with Newton-Raphson method
- **Standard PE Metrics**: IRR, TVPI (Total Value to Paid-In), DPI (Distributions to Paid-In), RVPI (Residual Value to Paid-In)
- **12-Month NAV Window**: Current valuations based on NAV data within 12-month window
- **Negative Cash Flow Support**: Proper handling of capital calls vs distributions
- **Performance Color Coding**: Visual indicators for positive/negative performance

### **Data Management**
- **Asset Classes**: Private Equity, Private Credit, Real Estate, Hedge Funds, Infrastructure
- **Investment Structures**: Limited Partnership, LLC, Corporation, Trust, Direct Investment
- **Cash Flow Types**: Capital Calls, Distributions, Fees, Yield, Return of Principal
- **Entity Types**: Family Office, Trust, LLC, Partnership, Individual, Corporation

### **Bulk Operations** 
- **Excel Template System**: Professional templates with validation dropdowns
- **Investment Import**: 30+ field bulk upload with comprehensive validation
- **Entity Import**: Entity and family member bulk creation  
- **NAV Import**: Bulk valuation uploads with investment matching
- **Cash Flow Import**: Bulk cash flow uploads with type validation
- **Template Downloads**: Fresh templates with current data for validation

### **Portfolio Analytics**
- **Total Portfolio Value**: Real-time NAV calculation across all investments
- **Performance Metrics**: Grid-based display of key performance indicators  
- **Capital Deployment**: Commitment vs called vs distributions analysis
- **Portfolio Overview**: Active investments, entity count, realization tracking
- **Asset Allocation**: Breakdown by asset class and vintage year
- **Timeline Analysis**: Portfolio value progression over time

## 🛡️ **Security & Data Management**

### **Data Validation & Integrity**
- **Comprehensive Input Validation**: All user inputs validated via Pydantic schemas
- **Cash Flow Constraints**: Proper handling of negative amounts for capital calls
- **Investment Field Validation**: 30+ field validation with business rule enforcement  
- **Template-Based Imports**: Structured data import with validation feedback
- **Database Constraints**: Foreign key relationships and data consistency enforcement

### **Authentication & Access**
- **Development Authentication**: Basic admin/password system for development
- **Session Management**: Secure session handling with proper logout
- **Production Ready**: Easily configurable for JWT/OAuth integration
- **User Context Tracking**: Request-level user identification for audit trails

### **Development Security Notes**
- ✅ **No Personal Data**: All sample data is generic and fictional
- ✅ **Configurable Database**: SQLite for development, PostgreSQL-ready for production  
- ✅ **Environment Variables**: Configurable settings via .env files
- ✅ **Professional Naming**: No personal identifiers in codebase
- ✅ **Clean Repository**: No machine-specific paths or sensitive data

## 🧪 **Testing**

### **API Testing**
- **Interactive Documentation**: http://localhost:8000/docs with live API testing
- **Sample Data**: Comprehensive test data including 11 investments with cash flows and NAVs
- **Validation Testing**: Test negative cash flows, bulk uploads, and edge cases

### **Manual Testing Examples**
```bash
# Test investment API
curl "http://localhost:8000/api/investments"

# Test individual investment  
curl "http://localhost:8000/api/investments/1"

# Test cash flows
curl "http://localhost:8000/api/investments/1/cashflows"

# Test portfolio performance
curl "http://localhost:8000/api/portfolio/performance"
```

## 📚 **Key Features Status**

### **✅ Fully Implemented**
- **Investment Management**: Complete CRUD with professional modal interface
- **Portfolio Performance**: True IRR calculations with 12-month NAV windows
- **Cash Flow Management**: Full cash flow tracking with negative amount support  
- **Bulk Upload System**: Excel templates with validation for investments, entities, NAVs, cash flows
- **Entity Management**: Complete entity and family member management
- **Document Management**: File upload, categorization, and search functionality
- **Analytics Dashboard**: Portfolio summary, allocation charts, performance metrics
- **Individual Investment Views**: Detailed investment pages with performance data

### **🏗️ In Development** 
- **Advanced Forecasting**: J-curve modeling and scenario analysis
- **Liquidity Management**: 12-month liquidity forecasting dashboard  
- **Regulatory Reporting**: Automated quarterly report generation
- **Advanced Analytics**: Benchmark comparisons and peer analysis

### **🔮 Planned Features**
- **Banking Integration**: Real-time cash position connectivity
- **Mobile Application**: Native mobile interface for key features
- **ESG Integration**: Impact and sustainability metrics
- **API Integrations**: Third-party data feeds and reporting systems

## 🔧 **Configuration & Deployment**

### **Development Setup**
- **Database**: SQLite (portfolio_tracker.db) created automatically
- **Ports**: Backend on 8000, Frontend on 3000
- **Authentication**: admin/password (configurable in production)
- **File Storage**: Local uploads/ directory for documents

### **Production Considerations**  
- **Database**: Upgrade to PostgreSQL for production use
- **Authentication**: Implement JWT/OAuth2 authentication system
- **File Storage**: Configure cloud storage (AWS S3, Azure Blob, etc.)
- **SSL/TLS**: Enable HTTPS for secure communications
- **Environment Variables**: Configure production settings via .env
- **Backup Strategy**: Implement regular database backups

## 🤝 **Contributing**

This is a professional-grade private markets management system suitable for:
- Family offices managing private market portfolios
- Investment managers needing performance tracking
- Financial advisors serving high-net-worth clients
- Institutional investors requiring detailed analytics

Contributions welcome for:
- Performance optimizations and database efficiency
- Additional asset class support and investment structures  
- Enhanced visualizations and reporting features
- Security improvements and production hardening
- Test coverage expansion and automation

## ⚖️ **License**

This project is intended for educational and professional development purposes. Please ensure compliance with all applicable financial regulations when handling real investment data.

---

**Private Markets Portfolio Tracker**  
*Professional Family Office Portfolio Management*  
*Built for Institutional-Grade Investment Tracking*
