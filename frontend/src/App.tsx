import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Holdings from './pages/Holdings';
import InvestmentDetails from './pages/InvestmentDetails';
import Visuals from './pages/Visuals';
import Calendar from './pages/Calendar';
import Documents from './pages/Documents';
import Entities from './pages/Entities';
import LiquidityForecast from './pages/LiquidityForecast';
import BulkUpload from './pages/BulkUpload';
import PageErrorBoundary from './components/PageErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { setupGlobalErrorHandlers } from './hooks/useErrorHandler';
import './App.css';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { authState, logout } = useAuth();
  
  return (
    <nav className="main-navigation">
      <div className="nav-links">
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
          Visuals & Analytics
        </Link>
        <Link 
          to="/calendar" 
          className={`nav-link ${location.pathname === '/calendar' ? 'active' : ''}`}
        >
          Cash Flow Calendar
        </Link>
        <Link 
          to="/documents" 
          className={`nav-link ${location.pathname === '/documents' ? 'active' : ''}`}
        >
          Documents
        </Link>
        <Link 
          to="/entities" 
          className={`nav-link ${location.pathname === '/entities' ? 'active' : ''}`}
        >
          Entity Management
        </Link>
        <Link 
          to="/liquidity" 
          className={`nav-link ${location.pathname === '/liquidity' ? 'active' : ''}`}
        >
          Liquidity Forecast
        </Link>
        <Link 
          to="/bulk-upload" 
          className={`nav-link ${location.pathname === '/bulk-upload' ? 'active' : ''}`}
        >
          Bulk Upload
        </Link>
      </div>
      
      <div className="nav-user">
        <span className="user-info">
          👤 {authState.user?.username}
        </span>
        <button 
          onClick={logout}
          className="logout-button"
          title="Logout"
        >
          🚪 Logout
        </button>
      </div>
    </nav>
  );
};

function AppContent() {
  return (
    <ProtectedRoute>
      <div className="App">
        <header className="App-header">
          <h1>Private Markets Portfolio Tracker</h1>
        </header>
        <main>
          <Navigation />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/holdings" replace />} />
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
              <Route path="/investment/:id" element={
                <PageErrorBoundary pageName="Investment Details">
                  <InvestmentDetails />
                </PageErrorBoundary>
              } />
            </Routes>
          </div>
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
          <AppContent />
        </Router>
      </AuthProvider>
    </PageErrorBoundary>
  );
}

export default App;