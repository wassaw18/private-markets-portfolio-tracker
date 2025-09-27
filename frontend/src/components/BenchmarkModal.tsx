import React, { useState, useEffect, useCallback } from 'react';
import { MarketBenchmark, BenchmarkReturn, marketBenchmarkAPI } from '../services/api';
import './BenchmarkModal.css';

interface BenchmarkModalProps {
  benchmark: MarketBenchmark;
  onClose: () => void;
}

const BenchmarkModal: React.FC<BenchmarkModalProps> = ({ benchmark, onClose }) => {
  const [returns, setReturns] = useState<BenchmarkReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newReturn, setNewReturn] = useState({ period: '', return_value: '' });
  const [isAdding, setIsAdding] = useState(false);

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await marketBenchmarkAPI.getBenchmarkReturns(benchmark.id);
      setReturns(data.sort((a, b) => new Date(b.period_date).getTime() - new Date(a.period_date).getTime()));
    } catch (err: any) {
      setError('Failed to fetch returns: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [benchmark.id]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleAddReturn = async () => {
    if (!newReturn.period || !newReturn.return_value) {
      setError('Please enter both period and return value');
      return;
    }

    try {
      setIsAdding(true);
      setError(null);
      
      // Parse the period (YYYY-MM format) to create period_date (YYYY-MM-01)
      const [year, month] = newReturn.period.split('-');
      const period_date = `${year}-${month}-01`;
      
      await marketBenchmarkAPI.createBenchmarkReturn(benchmark.id, {
        period_date,
        total_return: parseFloat(newReturn.return_value) / 100 // Convert percentage to decimal
      });
      
      setNewReturn({ period: '', return_value: '' });
      await fetchReturns(); // Refresh the list
    } catch (err: any) {
      setError('Failed to add return: ' + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "period,return\n2024-01,0.05\n2024-02,-0.02\n2024-03,0.03";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${benchmark.name.replace(/\s+/g, '_')}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadData = () => {
    if (returns.length === 0) {
      setError('No data to download');
      return;
    }

    const csvHeader = "period,return\n";
    const csvContent = returns.map(r => {
      const period = r.period_date.substring(0, 7); // YYYY-MM format
      const returnPct = ((r.total_return || 0) * 100).toFixed(4); // Convert to percentage
      return `${period},${returnPct}`;
    }).join('\n');
    
    const fullCsv = csvHeader + csvContent;
    const blob = new Blob([fullCsv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${benchmark.name.replace(/\s+/g, '_')}_data.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatReturn = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatPeriod = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="benchmark-modal">
        <div className="modal-header">
          <h3>📈 {benchmark.name}</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="benchmark-info">
          <div className="info-grid">
            <div><strong>Ticker:</strong> {benchmark.ticker}</div>
            <div><strong>Category:</strong> {benchmark.category}</div>
            <div><strong>Data Points:</strong> {returns.length} monthly returns</div>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={handleDownloadTemplate} className="download-btn">
            📄 Download Template
          </button>
          <button onClick={handleDownloadData} className="download-btn" disabled={returns.length === 0}>
            💾 Download Data
          </button>
        </div>

        {/* Add New Return */}
        <div className="add-return-section">
          <h4>Add Monthly Return</h4>
          <div className="add-return-form">
            <div className="form-group">
              <label htmlFor="period">Period (YYYY-MM):</label>
              <input
                type="month"
                id="period"
                value={newReturn.period}
                onChange={(e) => setNewReturn({ ...newReturn, period: e.target.value })}
                className="period-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="return">Return (%):</label>
              <input
                type="number"
                step="0.01"
                id="return"
                value={newReturn.return_value}
                onChange={(e) => setNewReturn({ ...newReturn, return_value: e.target.value })}
                placeholder="e.g., 5.25 for 5.25%"
                className="return-input"
              />
            </div>
            <button 
              onClick={handleAddReturn} 
              disabled={isAdding || !newReturn.period || !newReturn.return_value}
              className="add-return-btn"
            >
              {isAdding ? 'Adding...' : 'Add Return'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="error-close">×</button>
          </div>
        )}

        {/* Returns Data Table */}
        <div className="returns-section">
          <h4>Monthly Returns Data</h4>
          {loading ? (
            <div className="loading">Loading returns data...</div>
          ) : (
            <div className="returns-table-container">
              <table className="returns-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Monthly Return</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.length > 0 ? (
                    returns.map((returnData) => (
                      <tr key={returnData.id}>
                        <td>{formatPeriod(returnData.period_date)}</td>
                        <td className={(returnData.total_return || 0) >= 0 ? 'positive' : 'negative'}>
                          {formatReturn(returnData.total_return || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="no-data">No return data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BenchmarkModal;