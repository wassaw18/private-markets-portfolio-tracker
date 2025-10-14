# Private Markets Portfolio Tracker

A comprehensive, institutional-grade portfolio management system designed for family offices and private markets investors. Built with React (TypeScript) frontend and FastAPI (Python) backend with multi-tenant architecture and JWT authentication.

## 🎯 **Key Features**

### **🏛️ Multi-Tenant Architecture & Security**
- **JWT Authentication System** with secure token-based authentication and automatic refresh
- **Role-Based Access Control** with Admin, Manager, Contributor, and Viewer permission levels
- **Tenant Data Isolation** ensuring complete data segregation between organizations
- **UUID-Based Resource Identification** for enhanced security and scalability
- **User Management System** with tenant-specific user accounts and permissions
- **Secure Session Management** with token expiration and renewal mechanisms
- **Production-Ready Authentication** supporting multiple organizations and users

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
- **Asset Class Allocation Charts** with interactive breakdowns and fixed tooltip display
- **Vintage Year Analysis** with portfolio diversification insights
- **Commitment vs Called Analysis** showing capital deployment efficiency
- **J-Curve Visualization** for portfolio performance over time
- **Portfolio Timeline Charts** showing value progression
- **Comprehensive Benchmark Management** with dedicated Benchmarks page
- **PME Analysis (Public Markets Equivalent)** with TVPI-based performance comparison
- **Interactive Performance Comparison** with indexed performance visualization starting from common inception
- **Asset Class Grouping** for aggregated performance analysis against benchmarks
- **Relative Performance Analysis** with customizable date ranges and benchmark selection
- **Reference Data Tables** with filterable market benchmark datasets

### **📄 Document Management**
- **Enterprise Document Management System** with full tenant isolation
- **Advanced Document Upload** with drag-and-drop interface and file validation
- **Comprehensive Categorization** (Capital Calls, K-1 Forms, Quarterly Reports, GP Correspondence, etc.)
- **Document Status Workflow** (Pending Review, Approved, Archived, etc.)
- **Powerful Search & Filtering** with full-text search and metadata filtering
- **Investment & Entity Linking** for organized document relationships
- **Document Statistics Dashboard** with analytics and reporting
- **Tag Management System** for flexible document organization
- **Secure File Storage** with access control and audit trails

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
# Terminal 1: Multi-Tenant Backend (from project root)
source venv/bin/activate
python -m uvicorn app.main_tenant:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend (from frontend/ directory)
cd frontend
npm start

# Alternative: Legacy Single-Tenant Backend
# python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### **5. Access Application**
- **Application**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **Default Test Accounts**:
  - Admin: `admin` / `admin123` (tenant: Default Organization)
  - Manager: `manager` / `manager123` (tenant: Default Organization)
  - Contributor: `testuser` / `testuser123` (tenant: Default Organization)
  - Will (Admin): `will` / `will123` (tenant: Test Tenant - Will)

## 📁 **Project Structure**

```
private-markets-tracker/
├── README.md                     # This file
├── PRODUCT_ROADMAP.md            # Enterprise development roadmap
├── requirements.txt              # Python dependencies
├── .env                          # Environment configuration (PostgreSQL credentials)
├── app/                          # FastAPI Backend
│   ├── main_tenant.py            # Multi-tenant API with JWT authentication
│   ├── main.py                   # Legacy single-tenant API
│   ├── models.py                 # SQLAlchemy database models with tenant support
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── auth.py                   # JWT authentication and authorization
│   ├── crud_tenant.py            # Tenant-aware database operations
│   ├── crud.py                   # Legacy database operations
│   ├── database.py               # Database configuration
│   ├── performance.py            # Portfolio performance calculations
│   ├── document_service.py       # Document management system
│   ├── excel_template_service.py # Excel template & bulk upload system
│   ├── entity_relationships.py   # Entity hierarchy management
│   ├── calendar_service.py       # Cash flow calendar functionality
│   ├── dashboard.py              # Dashboard analytics
│   ├── benchmark_service.py      # Benchmark data management
│   ├── pme_service.py            # PME analysis and calculation engine
│   ├── migration_utility.py      # Database migration utilities
│   └── routers/                  # API route modules
│       ├── auth.py               # Authentication endpoints
│       ├── tenant_api.py         # Tenant-aware API endpoints
│       ├── pitchbook_benchmarks.py  # PitchBook benchmark endpoints
│       └── relative_performance.py  # Relative performance analysis
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
│   │   │   ├── BenchmarkModal.tsx       # Benchmark data management modal
│   │   │   ├── DateRangePicker.tsx      # Reusable date range selection
│   │   │   └── [60+ other components]
│   │   ├── pages/                # Page-level components
│   │   │   ├── Holdings.tsx      # Main holdings page
│   │   │   ├── Dashboard.tsx     # Executive portfolio dashboard
│   │   │   ├── InvestmentDetails.tsx  # Individual investment view
│   │   │   ├── BulkUpload.tsx    # Bulk import interface
│   │   │   ├── Entities.tsx      # Entity management page
│   │   │   ├── Documents.tsx     # Document management
│   │   │   ├── Visuals.tsx       # Analytics dashboard
│   │   │   ├── Benchmarks.tsx    # Comprehensive benchmark management
│   │   │   └── BenchmarkManagement.tsx  # Legacy benchmark interface
│   │   ├── services/             # API service layer
│   │   ├── types/                # TypeScript type definitions
│   │   ├── styles/               # Global CSS and design system
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
- **Multi-Tenant Architecture** with complete data isolation between organizations
- **JWT Authentication** with role-based access control and automatic token refresh
- **UUID-Based Identification** for all resources with dual int/UUID support during migration
- **RESTful API** with automatic OpenAPI documentation at `/docs`
- **PostgreSQL Database** with comprehensive schema for private markets data and tenant support
- **Pydantic Validation** for type safety and data integrity
- **Advanced Performance Calculations** with true portfolio-level IRR and cash flow sign conventions
- **Bulk Upload System** with Excel template generation and validation
- **Entity Relationship Management** with categorized relationships (Family, Business, Trust, Professional, Other)
- **Secure Document Management** with tenant-aware file storage and metadata

### **Frontend (React + TypeScript)**
- **Modern React** with hooks and functional components
- **TypeScript** for type safety and enhanced developer experience
- **Professional UI Design** optimized for family office workflows with luxury design system
- **Recharts Integration** for financial data visualizations with fixed tooltip handling
- **Responsive Design** with simplified CSS Grid and static component styling
- **Context-Based State Management** for user authentication and global state
- **Luxury Design System** with consistent color palette and professional aesthetics

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
- **Production JWT Authentication**: Secure token-based authentication with automatic refresh
- **Role-Based Access Control**: Admin, Manager, and Viewer permission levels
- **Multi-Tenant Security**: Complete data isolation between organizations
- **Session Management**: Secure token handling with expiration and renewal
- **User Context Tracking**: Request-level user identification for audit trails
- **OAuth Ready**: Extensible authentication system for enterprise integration

### **Development Security Notes**
- ✅ **No Personal Data**: All sample data is generic and fictional
- ✅ **PostgreSQL Database**: Production-ready database with proper connection pooling
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
- **Multi-Tenant Architecture**: Complete JWT authentication with role-based access control
- **Enterprise Document Management**: Full document lifecycle with tenant isolation and search
- **Investment Management**: Complete CRUD with professional modal interface
- **Portfolio Performance**: True IRR calculations with 12-month NAV windows
- **Cash Flow Management**: Full cash flow tracking with negative amount support
- **Bulk Upload System**: Excel templates with validation for investments, entities, NAVs, cash flows
- **Entity Management**: Complete entity and family member management
- **Executive Dashboard**: Clean portfolio summary with asset class breakdown and entity analysis
- **Individual Investment Views**: Detailed investment pages with performance data
- **Comprehensive Benchmark Management**: Dedicated Benchmarks page with PME analysis
- **Relative Performance Analysis**: Interactive benchmark comparison with customizable date ranges
- **Reference Data Management**: Filterable benchmark datasets with quarterly data
- **Static Professional UI**: Removed hover animations for institutional-grade appearance
- **Responsive Grid Layouts**: Simplified CSS grid system for consistent display
- **Fixed Chart Interactions**: Resolved tooltip display issues in pie charts

### **🏗️ In Development**
- **Advanced Forecasting**: J-curve modeling and scenario analysis
- **Liquidity Management**: 12-month liquidity forecasting dashboard
- **Enhanced PME Features**: Multi-period analysis and risk metrics integration
- **Advanced Analytics**: Portfolio optimization and stress testing

### **🔮 Planned Features**
- **UUID Migration**: Convert integer IDs to UUIDs for enhanced security and privacy
  - Prevents information leakage about system size and growth
  - Eliminates enumeration attack vectors
  - Provides globally unique identifiers suitable for distributed systems
- **Banking Integration**: Real-time cash position connectivity
- **Mobile Application**: Native mobile interface for key features
- **ESG Integration**: Impact and sustainability metrics
- **API Integrations**: Third-party data feeds and reporting systems

## 🆕 **Recent Improvements**

### **October 2025 Release - Multi-Tenant Migration Complete**
- **🏛️ Multi-Tenant Architecture**: Complete implementation of JWT authentication with role-based access control (Admin/Manager/Contributor/Viewer)
- **📄 Enterprise Document Management**: Full document lifecycle management with tenant isolation and comprehensive search
- **🔐 Production Security**: JWT tokens with automatic refresh, row-level tenant isolation via PostgreSQL
- **🎯 Tenant Data Isolation**: Complete data segregation with `tenant_id` filtering on all queries
- **🔧 Authentication Integration**: Frontend JWT interceptors with automatic token renewal and error handling
- **📊 Performance Calculations**: Migrated IRR calculations with proper cash flow sign conventions
- **💰 Investment CRUD Migration**: All investment-specific endpoints (cashflows, valuations) migrated to multi-tenant system
- **🏗️ Entity Relationships**: Added categorized relationships (Family, Business, Trust, Professional, Other)
- **🗄️ PostgreSQL Migration**: Full migration from SQLite to PostgreSQL with sequence management

### **Investment Status & Navigation Enhancements (October 2025)**
- **📊 Accurate Investment Counting**: Fixed dashboard to properly count investments by status (Active, Dormant, Realized) based on actual investment status field rather than presence of NAV/cash flows
- **🧭 Investment Detail Navigation**: Added dropdown selector on investment detail pages to quickly navigate between investments without returning to Holdings table
- **🔄 Status-Based Organization**: Investments in dropdown are grouped by status (Active, Dormant, Realized) for easy identification
- **🔗 Route Consistency**: Unified all investment detail routes to `/investments/:id` for consistent navigation from Holdings table and dropdown selector
- **✨ Enhanced Status Management**: Consolidated duplicate status displays into single modal-based status management interface with clickable status button in Performance Metrics card

### **September 2025 Release - Professional UI & Benchmarks**
- **🎯 Comprehensive Benchmark Management**: New dedicated Benchmarks page with PME analysis, relative performance comparison, and reference data management
- **🎨 Professional UI Enhancement**: Implemented static design by removing hover animations, simplified grid layouts from 8 complex variants to responsive auto-fit grid
- **🔧 Chart & Interface Fixes**: Resolved pie chart tooltip display issues, optimized space usage across pages, improved tab styling consistency
- **📊 Enhanced Analytics**: Added customizable date range selection, improved benchmark comparison visualizations, integrated quarterly data display
- **🧹 Code Quality**: Eliminated CSS specificity conflicts, removed deprecated components, streamlined frontend architecture

### **Technical Debt Reduction**
- **Simplified CSS Architecture**: Reduced from 8 complex grid variants to single responsive system
- **Component Cleanup**: Removed unused forecast, optimization, and analysis widget components
- **CSS Specificity Resolution**: Fixed global style conflicts by making component styles more specific
- **Static Design Implementation**: Eliminated hover animations for professional institutional appearance

## 🔧 **Configuration & Deployment**

### **Development Setup**
- **Database**: PostgreSQL (portfolio_tracker_db) with connection pooling
- **Ports**: Backend on 8000, Frontend on 3000
- **Authentication**: JWT-based with test accounts (see Access Application section above)
- **File Storage**: Local uploads/ directory for documents
- **Environment**: Configure via .env file (DATABASE_URL, JWT_SECRET, etc.)

### **Production Considerations**
- **Database**: Already using PostgreSQL - configure production credentials and connection pooling
- **Authentication**: Production JWT secret keys and OAuth2 integration
- **File Storage**: Configure cloud storage (AWS S3, Azure Blob, etc.)
- **SSL/TLS**: Enable HTTPS for secure communications
- **Environment Variables**: Configure production settings via .env
- **Backup Strategy**: Implement regular PostgreSQL backups and point-in-time recovery
- **Multi-Tenant Setup**: Configure tenant provisioning, user management, and SSO integration
- **Security Hardening**: Implement UUID-based IDs to prevent information leakage

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
