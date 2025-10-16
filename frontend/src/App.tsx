import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Holdings from './pages/Holdings';
import InvestmentDetails from './pages/InvestmentDetails';
import Visuals from './pages/Visuals';
import Calendar from './pages/Calendar';
import Documents from './pages/Documents';
import Entities from './pages/Entities';
import LiquidityForecast from './pages/LiquidityForecast';
import BulkUpload from './pages/BulkUpload';
import Benchmarks from './pages/Benchmarks';
import Reports from './pages/Reports';
import FundDashboard from './pages/FundDashboard';
import LPCapitalAccounts from './pages/LPCapitalAccounts';
import Signup from './pages/Signup';
import AcceptInvitation from './pages/AcceptInvitation';
import PageErrorBoundary from './components/PageErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { setupGlobalErrorHandlers } from './hooks/useErrorHandler';
import './styles/luxury-design-system.css';
import './App.css';

const Navigation: React.FC = () => {
  const location = useLocation();
  
  return (
    <nav className="main-navigation">
      <div className="nav-links">
        <Link
          to="/dashboard"
          className={`nav-link ${location.pathname === '/dashboard' || location.pathname === '/' ? 'active' : ''}`}
        >
          Dashboard
        </Link>
        <Link
          to="/fund-dashboard"
          className={`nav-link ${location.pathname === '/fund-dashboard' ? 'active' : ''}`}
        >
          Fund Manager
        </Link>
        <Link
          to="/lp-accounts"
          className={`nav-link ${location.pathname === '/lp-accounts' ? 'active' : ''}`}
        >
          LP Accounts
        </Link>
        <Link
          to="/holdings"
          className={`nav-link ${location.pathname === '/holdings' ? 'active' : ''}`}
        >
          Holdings
        </Link>
        <Link
          to="/visuals"
          className={`nav-link ${location.pathname === '/visuals' ? 'active' : ''}`}
        >
          Analytics
        </Link>
        <Link
          to="/liquidity"
          className={`nav-link ${location.pathname === '/liquidity' || location.pathname === '/calendar' ? 'active' : ''}`}
        >
          Cash Flows
        </Link>
        <Link
          to="/entities"
          className={`nav-link ${location.pathname === '/entities' ? 'active' : ''}`}
        >
          Entities
        </Link>
        <Link
          to="/benchmarks"
          className={`nav-link ${location.pathname === '/benchmarks' ? 'active' : ''}`}
        >
          Benchmarks
        </Link>
        <Link
          to="/reports"
          className={`nav-link ${location.pathname === '/reports' ? 'active' : ''}`}
        >
          Reports
        </Link>
        <Link
          to="/documents"
          className={`nav-link ${location.pathname === '/documents' || location.pathname === '/bulk-upload' ? 'active' : ''}`}
        >
          Operations
        </Link>
      </div>
    </nav>
  );
};

const UserControls: React.FC = () => {
  const { authState, logout } = useAuth();
  
  return (
    <div className="user-controls">
      <span className="user-info">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/>
        </svg>
        {authState.user?.username}
      </span>
      <button 
        onClick={logout}
        className="logout-button"
        title="Logout"
      >
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
          <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708L13.207 5a.5.5 0 1 0-.707.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793L12.5 10.207a.5.5 0 0 0 .707.708l2.647-2.647z"/>
        </svg>
        Logout
      </button>
    </div>
  );
};

function AppContent() {
  return (
    <ProtectedRoute>
      <div className="App">
        <header className="App-header">
          <h1>Private Markets Portfolio Tracker</h1>
          <UserControls />
        </header>
        <main>
          <Navigation />
          <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                <PageErrorBoundary pageName="Dashboard">
                  <Dashboard />
                </PageErrorBoundary>
              } />
              <Route path="/fund-dashboard" element={
                <PageErrorBoundary pageName="Fund Manager Dashboard">
                  <FundDashboard />
                </PageErrorBoundary>
              } />
              <Route path="/lp-accounts" element={
                <PageErrorBoundary pageName="LP Capital Accounts">
                  <LPCapitalAccounts />
                </PageErrorBoundary>
              } />
              <Route path="/holdings" element={
                <PageErrorBoundary pageName="Holdings">
                  <Holdings />
                </PageErrorBoundary>
              } />
              <Route path="/visuals" element={
                <PageErrorBoundary pageName="Visuals & Analytics">
                  <Visuals />
                </PageErrorBoundary>
              } />
              <Route path="/calendar" element={
                <PageErrorBoundary pageName="Cash Flow Calendar">
                  <Calendar />
                </PageErrorBoundary>
              } />
              <Route path="/documents" element={
                <PageErrorBoundary pageName="Document Management">
                  <Documents />
                </PageErrorBoundary>
              } />
              <Route path="/entities" element={
                <PageErrorBoundary pageName="Entity Management">
                  <Entities />
                </PageErrorBoundary>
              } />
              <Route path="/liquidity" element={
                <PageErrorBoundary pageName="Liquidity Forecast">
                  <LiquidityForecast />
                </PageErrorBoundary>
              } />
              <Route path="/bulk-upload" element={
                <PageErrorBoundary pageName="Bulk Upload">
                  <BulkUpload />
                </PageErrorBoundary>
              } />
              <Route path="/benchmarks" element={
                <PageErrorBoundary pageName="Benchmark Analysis">
                  <Benchmarks />
                </PageErrorBoundary>
              } />
              <Route path="/reports" element={
                <PageErrorBoundary pageName="Reports">
                  <Reports />
                </PageErrorBoundary>
              } />
              <Route path="/investments/:id" element={
                <PageErrorBoundary pageName="Investment Details">
                  <InvestmentDetails />
                </PageErrorBoundary>
              } />
          </Routes>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  // Set up global error handlers on app initialization
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  return (
    <PageErrorBoundary pageName="Application">
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/signup" element={
              <PageErrorBoundary pageName="Signup">
                <Signup />
              </PageErrorBoundary>
            } />
            <Route path="/accept-invite/:token" element={
              <PageErrorBoundary pageName="Accept Invitation">
                <AcceptInvitation />
              </PageErrorBoundary>
            } />

            {/* Protected routes */}
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </Router>
      </AuthProvider>
    </PageErrorBoundary>
  );
}

export default App;