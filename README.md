# Private Markets Portfolio Tracker

A comprehensive, institutional-grade portfolio management system designed for family offices and private markets investors. Built with React (TypeScript) frontend and FastAPI (Python) backend.

## 🎯 **Key Features**

### **📊 Investment Management**
- **Professional 4-Tab Investment Modal** with 22+ institutional-grade fields
- **Performance Analytics** with IRR/TVPI calculations using Newton-Raphson method
- **Cash Flow Tracking** with multiple flow types (Capital Calls, Distributions, Fees, Yield)
- **Valuation Management** with automated performance grade calculations

### **🔮 Advanced Forecasting**
- **Sophisticated Pacing Model** with J-curve modeling and scenario analysis
- **12-Month Liquidity Forecast Dashboard** with portfolio-level visibility
- **Forecast Override System** for incorporating known/confirmed cash flows
- **Stress Testing** scenarios (accelerated calls, delayed distributions)
- **Liquidity Alerts** and risk management warnings

### **🏢 Entity & Relationship Management**
- **Complex Entity Structures** (Family Office, Trusts, LLCs, Partnerships)
- **Entity Hierarchy Visualization** with parent/subsidiary relationships
- **Investment Ownership Tracking** with percentage allocations
- **Family Member Management** with role assignments

### **📅 Cash Flow & Calendar Management**
- **Interactive Cash Flow Calendar** with monthly/quarterly views
- **Cash Flow Matching** opportunities for liquidity optimization
- **Performance Insights** with rolling metrics and forecasting
- **Document Integration** with cash flow attachments

### **📄 Document Management & Bulk Upload**
- **Secure Document Upload** with categorization and tagging
- **Document Status Tracking** (Pending, Received, Processed)
- **Professional Excel Template System** for bulk data imports
- **Investment Bulk Upload** with 32-field validation and error handling
- **Entity Bulk Upload** with conditional validation and 85% code reuse
- **Document Search and Filtering** with confidentiality controls

### **🔒 Audit & Compliance**
- **Enhanced Basic Auditing System** with complete user tracking
- **"Who changed what when"** visibility for all data modifications
- **Regulatory Compliance** features for family office operations
- **Data Quality Assurance** through comprehensive audit trails

## 🚀 **Quick Start**

### **Prerequisites**
- Python 3.8+ (3.12 recommended)
- Node.js 16+ (18+ recommended)
- npm 8+ or yarn

### **Installation**

#### **1. Clone Repository**
```bash
git clone <your-repo-url>
cd private-markets-portfolio-tracker
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

# Run database migrations
python migrations/migration_audit_fields.py
python migrations/migration_liquidity_forecast.py
python migrations/migration_entity_management.py
```

#### **3. Frontend Setup**
```bash
cd frontend
npm install
```

#### **4. Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (optional for development)
```

#### **5. Start Application**
```bash
# Terminal 1: Backend (from project root)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend (from frontend/ directory)
npm start
```

#### **6. Access Application**
- **Application**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **Default Login**: admin / password

## 📁 **Project Structure**

```
private-markets-portfolio-tracker/
├── README.md                     # This file
├── requirements.txt             # Python dependencies
├── portfolio.db                 # SQLite database
├── app/                          # FastAPI Backend
│   ├── main.py                   # API endpoints and application setup
│   ├── models.py                 # SQLAlchemy database models
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── crud.py                   # Database operations
│   ├── database.py               # Database configuration
│   ├── performance.py            # IRR/TVPI calculation engine
│   ├── pacing_model.py           # Sophisticated cash flow forecasting
│   ├── liquidity_forecast_service.py  # 12-month liquidity forecasting
│   ├── entity_relationships.py   # Entity hierarchy management
│   ├── excel_template_service.py # Excel template & bulk upload engine
│   └── ...                       # Additional services
├── frontend/                     # React TypeScript Frontend
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── pages/               # Page-level components
│   │   ├── contexts/            # React contexts (Auth, etc.)
│   │   ├── services/            # API service layer
│   │   ├── types/               # TypeScript type definitions
│   │   └── utils/               # Utility functions
│   ├── public/                  # Static assets
│   └── package.json             # Node.js dependencies
├── docs/                        # Documentation
│   ├── implementations/         # Feature implementation summaries
│   ├── FAMILY_OFFICE_FEATURE_ROADMAP.md  # Strategic roadmap
│   └── GITHUB_SECURITY_CHECKLIST.md      # Security guidelines
├── migrations/                  # Database migration scripts
├── tests/                       # Test files
├── scripts/                     # Utility and validation scripts
├── sample-data/                 # Sample data for testing
└── deployment/                  # Deployment guides
```

## 🔧 **Architecture**

### **Backend (FastAPI + SQLAlchemy)**
- **RESTful API** with automatic OpenAPI documentation
- **SQLite Database** (easily upgradeable to PostgreSQL)
- **Pydantic Validation** for type safety and data integrity
- **Advanced ORM Models** with complex relationships and indexing

### **Frontend (React + TypeScript)**
- **Modern React** with hooks and functional components
- **TypeScript** for type safety and developer experience
- **Recharts** for professional data visualizations
- **Responsive Design** with CSS Grid and Flexbox

### **Key Architectural Decisions**
- **API-First Design**: Clear separation between frontend and backend
- **Entity-Relationship Model**: Supports complex family office structures
- **Audit-First Approach**: All modifications tracked for compliance
- **Performance Optimized**: Efficient database queries and responsive UI

## 📊 **Core Capabilities**

### **Investment Tracking**
- **Asset Classes**: Private Equity, Private Credit, Hedge Funds, Real Estate
- **Performance Metrics**: IRR, TVPI, DPI, RVPI with industry-standard calculations
- **Cash Flow Types**: Capital Calls, Contributions, Distributions, Yield, Fees
- **Forecasting**: Sophisticated pacing model with J-curve analysis

### **Entity Management**
- **Entity Types**: Family Office, Trust, LLC, Partnership, Individual
- **Relationship Mapping**: Parent/subsidiary, ownership, control relationships
- **Investment Ownership**: Track percentage allocations across entities
- **Family Structure**: Complete family member and role management

### **Liquidity Management**
- **12-Month Forecasting**: Rolling liquidity visibility with monthly granularity
- **Override System**: Incorporate known/confirmed cash flows
- **Risk Alerts**: Early warning for liquidity shortfalls
- **Cash Flow Matching**: Optimize liquidity through distribution/call alignment

## 🛡️ **Security & Compliance**

### **Data Protection**
- **User Tracking**: Complete audit trail for all data modifications
- **Soft Deletes**: Maintain data integrity and historical context
- **Input Validation**: Comprehensive validation on all user inputs
- **Error Handling**: Robust error management with user-friendly messages

### **Authentication & Authorization**
- **Basic Authentication**: Development-ready login system
- **Session Management**: Secure session handling with logout
- **User Context**: Request-level user tracking for audit trails
- **Production Ready**: Easy integration with JWT/OAuth systems

### **Development Security Notes**
- ✅ **No personal information** included in codebase
- ✅ **Generic demo data** only (no real financial information)
- ✅ **Configurable credentials** via environment variables
- ✅ **Localhost references** are configurable
- ✅ **Professional naming** throughout (no personal identifiers)

## 🧪 **Testing**

### **Run Tests**
```bash
# Backend tests
python tests/test_audit_system.py
python tests/test_performance.py
python tests/test_entity_management.py
python tests/test_bulk_upload_fix.py

# Frontend validation
cd frontend
npm test
```

### **API Testing**
- **Interactive Documentation**: http://localhost:8000/docs
- **Manual Testing**: Use Postman or curl with provided endpoints
- **Sample Data**: Seeder scripts available for testing

## 📚 **Documentation**

### **Implementation Guides**
- `docs/implementations/ENHANCED_AUDITING_IMPLEMENTATION_SUMMARY.md` - Complete audit system documentation
- `docs/implementations/LIQUIDITY_FORECAST_DASHBOARD_IMPLEMENTATION.md` - Liquidity forecasting features
- `docs/implementations/ENTITY_MANAGEMENT_IMPLEMENTATION.md` - Entity hierarchy system
- `docs/implementations/ENTITY_BULK_UPLOAD_IMPLEMENTATION.md` - Entity bulk upload system
- `docs/implementations/BULK_UPLOAD_FIX_SUMMARY.md` - Investment bulk upload improvements
- `docs/FAMILY_OFFICE_FEATURE_ROADMAP.md` - Future enhancement roadmap

### **Technical Documentation**
- `docs/implementations/PERFORMANCE_GRADE_METHODOLOGY.md` - Performance calculation methods
- `docs/implementations/EXCEL_TEMPLATES_IMPLEMENTATION.md` - Template system documentation
- Database schema documentation in model files

## 🔮 **Roadmap**

### **Immediate (Implemented)**
- ✅ Enhanced Basic Auditing System
- ✅ 12-Month Liquidity Forecast Dashboard
- ✅ Entity Relationship Management
- ✅ Professional Investment Modal
- ✅ Investment Bulk Upload with 32-field validation
- ✅ Entity Bulk Upload with conditional validation
- ✅ Professional Excel Template System

### **Next Priority**
- [ ] **Automated Client Reporting** - Professional quarterly report generation
- [ ] **Advanced Risk Analytics** - Portfolio stress testing and concentration monitoring
- [ ] **Regulatory Compliance Suite** - Beneficial ownership and compliance tracking

### **Future Enhancements**
- [ ] **ESG Integration** - Impact and sustainability metrics
- [ ] **Banking Integration** - Real-time cash position connectivity
- [ ] **Mobile App** - Native mobile interface
- [ ] **Advanced Analytics** - Peer benchmarking and market intelligence

## 🤝 **Contributing**

This is a professional-grade private markets management system. Contributions welcome for:
- Performance optimizations
- Additional asset class support
- Enhanced visualizations
- Security improvements
- Test coverage expansion

## ⚖️ **License**

This project is intended for educational and professional development purposes. Please ensure compliance with all applicable regulations when handling real financial data.

## 🚨 **Important Notes**

### **Development vs Production**
- **Current Configuration**: Development/demo use with basic authentication
- **Production Requirements**: 
  - Replace basic auth with proper authentication system
  - Configure production database (PostgreSQL recommended)
  - Set up SSL/TLS certificates
  - Update environment variables
  - Implement proper backup strategy

### **Data Privacy**
- **No Personal Data**: Codebase contains no personal or sensitive information
- **Demo Credentials**: Default admin/password for development only
- **Generic Examples**: All sample data is fictional and generic
- **Clean Repository**: No machine-specific paths or personal identifiers

---

**Private Markets Portfolio Tracker v2.0**  
*Enhanced with Liquidity Forecasting & Audit Capabilities*  
*Built for Family Offices and Institutional Investors*