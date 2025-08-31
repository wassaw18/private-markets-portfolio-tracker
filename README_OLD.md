# Private Markets Portfolio Tracker

A comprehensive, institutional-grade portfolio management system designed for family offices and private markets investors. Built with React (TypeScript) frontend and FastAPI (Python) backend.

## 🏗️ Architecture

```
private-markets-tracker/
├── app/                    # FastAPI Backend
│   ├── models.py          # SQLAlchemy database models
│   ├── schemas.py         # Pydantic request/response schemas
│   ├── database.py        # Database connection management
│   ├── crud.py            # Database CRUD operations
│   └── main.py            # FastAPI application
├── frontend/              # React Frontend
│   ├── src/
│   │   ├── types/         # TypeScript type definitions
│   │   ├── services/      # API integration layer
│   │   ├── pages/         # Main page components
│   │   └── components/    # Reusable UI components
│   └── public/
└── requirements.txt       # Python dependencies
```

## 🚀 Quick Start

### Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Start the React development server
npm start
```

## 📊 Features

### Milestone 1 ✅ - Database and API Setup
- **Database Schema**: Investments, CashFlows, Valuations tables
- **FastAPI Backend**: RESTful API with SQLite database
- **CRUD Endpoints**: Complete investment management API
- **Data Validation**: Pydantic models with enum validation

### Milestone 2 ✅ - Basic Holdings Management  
- **React Frontend**: Modern TypeScript-based UI
- **Holdings Dashboard**: Comprehensive investment overview
- **Add Investment Form**: All required fields with validation
- **Investment Table**: View, edit, delete functionality
- **API Integration**: Seamless backend communication

### Milestone 3 ✅ - Cash Flow and Valuation Input
- **Investment Details Page**: Individual investment deep-dive view
- **Cash Flow Management**: Contribution and distribution tracking
- **NAV Valuation Updates**: Periodic performance valuations
- **Financial Calculations**: Automatic totals and return metrics
- **Transaction History**: Chronological ordering with delete capability

### Milestone 4 ✅ - Performance Calculation Engine
- **Professional Financial Calculations**: IRR, TVPI, DPI, RVPI per industry standards
- **IRR Calculation**: Newton-Raphson method for accurate time-weighted returns
- **Portfolio Aggregation**: Weighted performance metrics across all investments
- **Real-time Updates**: Performance recalculation when cash flows/valuations change
- **Professional Display**: Color-coded metrics with performance grading

## 🔧 API Endpoints

### Investment Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/investments` | List all investments |
| POST | `/api/investments` | Create new investment |
| GET | `/api/investments/{id}` | Get specific investment |
| PUT | `/api/investments/{id}` | Update investment |
| DELETE | `/api/investments/{id}` | Delete investment |

### Cash Flow Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/investments/{id}/cashflows` | Get investment cash flows |
| POST | `/api/investments/{id}/cashflows` | Add cash flow transaction |
| DELETE | `/api/investments/{id}/cashflows/{cashflow_id}` | Delete cash flow |

### Valuation Management  
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/investments/{id}/valuations` | Get investment valuations |
| POST | `/api/investments/{id}/valuations` | Add NAV valuation |
| DELETE | `/api/investments/{id}/valuations/{valuation_id}` | Delete valuation |

### Performance Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/investments/{id}/performance` | Get investment performance metrics |
| GET | `/api/portfolio/performance` | Get portfolio-level performance |

## 📝 Database Schema

### Investments Table
- **name**: Investment fund name
- **asset_class**: Private Equity, Real Estate, etc.
- **investment_structure**: Limited Partnership, etc.
- **owner**: Investment entity owner
- **strategy**: Investment strategy description
- **vintage_year**: Year of investment
- **commitment_amount**: Total committed capital
- **called_amount**: Capital called to date
- **fees**: Associated fees

### CashFlows Table
- **investment_id**: Foreign key to investments
- **date**: Cash flow date
- **type**: Contribution or Distribution
- **amount**: Cash flow amount

### Valuations Table
- **investment_id**: Foreign key to investments
- **date**: Valuation date
- **nav_value**: Net Asset Value

## 🎯 Investment Types Supported

**Asset Classes:**
- Private Equity
- Private Credit
- Real Estate
- Infrastructure
- Hedge Funds
- Venture Capital

**Investment Structures:**
- Limited Partnership
- Fund of Funds
- Direct Investment
- Co-Investment
- Separate Account

## 🧪 Testing

### Backend Testing
```bash
# Validate API structure
python validate_structure.py
```

### Frontend Testing
```bash
# Validate React components
cd frontend
python validate_frontend.py
```

### Integration Testing
1. Start backend server: `uvicorn app.main:app --reload`
2. Start frontend server: `npm start`
3. Navigate to `http://localhost:3000`
4. Test CRUD operations through the UI

## 📱 Frontend Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **TypeScript**: Full type safety and autocomplete
- **Error Handling**: User-friendly error messages
- **Loading States**: Visual feedback during API calls
- **Form Validation**: Client-side validation before submission
- **Confirmation Dialogs**: Prevent accidental deletions
- **Currency Formatting**: Professional financial data display
- **Modal Editing**: In-place editing without page navigation

## 🔄 Development Workflow

1. **Backend Changes**: Modify models, add endpoints, test with validation script
2. **Frontend Changes**: Update components, add features, test with validation script  
3. **Integration**: Test full stack with both servers running
4. **Database**: SQLite file auto-created on first API call

## 📈 Next Steps (Future Milestones)

- **Milestone 3**: Cash flows and distributions tracking
- **Milestone 4**: Portfolio analytics and reporting
- **Milestone 5**: Performance metrics and benchmarking
- **Milestone 6**: User authentication and multi-tenancy

## 🛠️ Tech Stack

**Backend:**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- SQLite (Database)
- Pydantic (Data validation)
- Uvicorn (ASGI server)

**Frontend:**
- React 18 (UI framework)
- TypeScript (Type safety)
- Axios (HTTP client)
- CSS3 (Styling)
- Create React App (Build tooling)

## 📄 License

This project is developed for educational and portfolio management purposes.