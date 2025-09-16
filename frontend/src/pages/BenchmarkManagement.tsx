import React, { useState, useEffect } from 'react';
import { marketBenchmarkAPI, MarketBenchmark, BenchmarkReturn, ImportResult } from '../services/api';
import './BenchmarkManagement.css';

const BenchmarkManagement: React.FC = () => {
  const [benchmarks, setBenchmarks] = useState<MarketBenchmark[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<MarketBenchmark | null>(null);
  const [returns, setReturns] = useState<BenchmarkReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<ImportResult | null>(null);
  const [showAddReturn, setShowAddReturn] = useState(false);
  const [newReturn, setNewReturn] = useState({
    period_date: '',
    total_return: '',
    price_return: '',
    dividend_yield: '',
    notes: ''
  });

  const fetchBenchmarks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await marketBenchmarkAPI.getMarketBenchmarks();
      setBenchmarks(data);
    } catch (err: any) {
      setError('Failed to fetch benchmarks: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturns = async (benchmarkId: number) => {
    try {
      setReturnsLoading(true);
      const data = await marketBenchmarkAPI.getBenchmarkReturns(benchmarkId);
      setReturns(data.sort((a, b) => new Date(b.period_date).getTime() - new Date(a.period_date).getTime()));
    } catch (err: any) {
      setError('Failed to fetch returns: ' + err.message);
    } finally {
      setReturnsLoading(false);
    }
  };

  useEffect(() => {
    fetchBenchmarks();
  }, []);

  const handleBenchmarkSelect = (benchmark: MarketBenchmark) => {
    setSelectedBenchmark(benchmark);
    fetchReturns(benchmark.id);
    setUploadResult(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !selectedBenchmark) return;
    
    const file = event.target.files[0];
    if (!file) return;

    try {
      const result = await marketBenchmarkAPI.bulkImportBenchmarkReturns(selectedBenchmark.id, file);
      setUploadResult(result);
      
      // Refresh returns data
      await fetchReturns(selectedBenchmark.id);
      await fetchBenchmarks(); // Refresh counts
    } catch (err: any) {
      setError('Upload failed: ' + err.message);
    }
    
    // Clear the file input
    event.target.value = '';
  };

  const handleAddReturn = async () => {
    if (!selectedBenchmark) return;

    try {
      const returnData = {
        period_date: newReturn.period_date,
        total_return: newReturn.total_return ? parseFloat(newReturn.total_return) / 100 : undefined,
        price_return: newReturn.price_return ? parseFloat(newReturn.price_return) / 100 : undefined,
        dividend_yield: newReturn.dividend_yield ? parseFloat(newReturn.dividend_yield) / 100 : undefined,
        notes: newReturn.notes || undefined
      };

      await marketBenchmarkAPI.createBenchmarkReturn(selectedBenchmark.id, returnData);
      
      // Refresh data
      await fetchReturns(selectedBenchmark.id);
      await fetchBenchmarks();
      
      // Reset form
      setNewReturn({
        period_date: '',
        total_return: '',
        price_return: '',
        dividend_yield: '',
        notes: ''
      });
      setShowAddReturn(false);
    } catch (err: any) {
      setError('Failed to add return: ' + err.message);
    }
  };

  const handleDownloadTemplate = () => {
    // Create CSV template with proper format
    const csvContent = `period_date,total_return,price_return,dividend_yield,notes
2025-07-01,2.24,2.17,1.8,July 2025 S&P 500 returns
2025-06-01,3.49,3.37,1.8,June 2025 S&P 500 returns
2025-05-01,4.78,4.64,1.8,May 2025 S&P 500 returns`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'benchmark_returns_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatPercentage = (value?: number): string => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString: string): string => {
    // Parse as local date to avoid timezone shift (2025-07-01 stays July, not June)
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    });
  };

  if (loading) {
    return (
      <div className="benchmark-management">
        <div className="loading-state">Loading benchmark data...</div>
      </div>
    );
  }

  return (
    <div className="benchmark-management">
      <div className="benchmark-header">
        <h2>📈 Market Benchmark Management</h2>
        <p className="subtitle">Manage monthly returns data for market benchmarks used in PME analysis</p>
      </div>

      <div className="benchmark-layout">
        {/* Benchmarks List */}
        <div className="benchmarks-sidebar">
          <h3>Available Benchmarks</h3>
          <div className="benchmarks-list">
            {benchmarks.map((benchmark) => (
              <div
                key={benchmark.id}
                className={`benchmark-item ${selectedBenchmark?.id === benchmark.id ? 'selected' : ''}`}
                onClick={() => handleBenchmarkSelect(benchmark)}
              >
                <div className="benchmark-name">{benchmark.name}</div>
                <div className="benchmark-ticker">{benchmark.ticker}</div>
                <div className="benchmark-category">{benchmark.category}</div>
                <div className="benchmark-stats">
                  {benchmark.returns_count || 0} monthly returns
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benchmark Details */}
        <div className="benchmark-details">
          {selectedBenchmark ? (
            <>
              <div className="benchmark-info">
                <h3>{selectedBenchmark.name} ({selectedBenchmark.ticker})</h3>
                <p>{selectedBenchmark.description}</p>
                <div className="benchmark-meta">
                  <span>Category: {selectedBenchmark.category}</span>
                  <span>Data Source: {selectedBenchmark.data_source}</span>
                  <span>Status: {selectedBenchmark.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              {/* Upload Section */}
              <div className="upload-section">
                <h4>📤 Upload Returns Data</h4>
                <div className="upload-controls">
                  <div className="upload-buttons">
                    <label className="file-upload-btn">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                      Choose CSV File
                    </label>
                    <button 
                      onClick={handleDownloadTemplate}
                      className="download-template-btn"
                      type="button"
                    >
                      📄 Download Template
                    </button>
                  </div>
                  <span className="upload-help">
                    CSV format: period_date,total_return,price_return,dividend_yield,notes
                  </span>
                </div>

                {uploadResult && (
                  <div className={`upload-result ${uploadResult.error_count > 0 ? 'has-errors' : 'success'}`}>
                    <div className="result-summary">
                      ✅ {uploadResult.success_count} records imported successfully
                      {uploadResult.error_count > 0 && (
                        <span className="error-count">❌ {uploadResult.error_count} errors</span>
                      )}
                    </div>
                    {uploadResult.errors.length > 0 && (
                      <div className="error-details">
                        <h5>Errors:</h5>
                        <ul>
                          {uploadResult.errors.slice(0, 5).map((error, idx) => (
                            <li key={idx}>Row {error.row}: {error.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add Single Return */}
              <div className="add-return-section">
                <div className="section-header">
                  <h4>➕ Add Single Return</h4>
                  <button
                    onClick={() => setShowAddReturn(!showAddReturn)}
                    className="toggle-btn"
                  >
                    {showAddReturn ? 'Cancel' : 'Add Return'}
                  </button>
                </div>

                {showAddReturn && (
                  <div className="add-return-form">
                    <div className="form-row">
                      <label>
                        Period Date:
                        <input
                          type="date"
                          value={newReturn.period_date}
                          onChange={(e) => setNewReturn({...newReturn, period_date: e.target.value})}
                        />
                      </label>
                      <label>
                        Total Return (%):
                        <input
                          type="number"
                          step="0.01"
                          placeholder="2.24"
                          value={newReturn.total_return}
                          onChange={(e) => setNewReturn({...newReturn, total_return: e.target.value})}
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Price Return (%):
                        <input
                          type="number"
                          step="0.01"
                          placeholder="2.17"
                          value={newReturn.price_return}
                          onChange={(e) => setNewReturn({...newReturn, price_return: e.target.value})}
                        />
                      </label>
                      <label>
                        Dividend Yield (%):
                        <input
                          type="number"
                          step="0.01"
                          placeholder="1.8"
                          value={newReturn.dividend_yield}
                          onChange={(e) => setNewReturn({...newReturn, dividend_yield: e.target.value})}
                        />
                      </label>
                    </div>
                    <div className="form-row full-width">
                      <label>
                        Notes:
                        <input
                          type="text"
                          placeholder="Optional notes"
                          value={newReturn.notes}
                          onChange={(e) => setNewReturn({...newReturn, notes: e.target.value})}
                        />
                      </label>
                    </div>
                    <button onClick={handleAddReturn} className="add-btn">
                      Add Return
                    </button>
                  </div>
                )}
              </div>

              {/* Returns Data */}
              <div className="returns-section">
                <h4>📊 Returns Data ({returns.length} records)</h4>
                {returnsLoading ? (
                  <div className="loading-state">Loading returns...</div>
                ) : returns.length > 0 ? (
                  <div className="returns-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Total Return</th>
                          <th>Price Return</th>
                          <th>Dividend Yield</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returns.slice(0, 20).map((returnData) => (
                          <tr key={returnData.id}>
                            <td>{formatDate(returnData.period_date)}</td>
                            <td className="number">{formatPercentage(returnData.total_return)}</td>
                            <td className="number">{formatPercentage(returnData.price_return)}</td>
                            <td className="number">{formatPercentage(returnData.dividend_yield)}</td>
                            <td className="notes">{returnData.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {returns.length > 20 && (
                      <div className="table-footer">
                        Showing most recent 20 of {returns.length} records
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-data">
                    No returns data available. Upload a CSV file or add individual returns.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="no-selection">
              <h3>Select a Benchmark</h3>
              <p>Choose a benchmark from the left to view and manage its returns data.</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default BenchmarkManagement;