import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LPCapitalAccounts.css';

// MOCKUP DATA - Will be replaced with API calls
interface LimitedPartner {
  id: number;
  uuid: string;
  name: string;
  lp_type: string;
  commitment_amount: number;
  contact_email: string;
  contact_phone: string;
  has_side_letter: boolean;
  created_date: string;
}

interface CapitalAccount {
  id: number;
  lp_id: number;
  lp_name: string;
  total_committed: number;
  total_called: number;
  total_distributed: number;
  current_nav_balance: number;
  ownership_percentage: number;
  unfunded_commitment: number;
  net_investment: number;  // called - distributed
  moic: number;  // (distributed + nav) / called
  last_updated: string;
}

interface CapitalTransaction {
  id: number;
  date: string;
  transaction_type: 'Capital Call' | 'Distribution';
  amount: number;
  running_balance: number;
  status: 'Pending' | 'Received' | 'Overdue';
  notice_number?: string;
  notes?: string;
}

const LPCapitalAccounts: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<CapitalAccount[]>([]);
  const [selectedLP, setSelectedLP] = useState<CapitalAccount | null>(null);
  const [transactions, setTransactions] = useState<CapitalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    loadMockData();
  }, []);

  const loadMockData = () => {
    // MOCKUP: Sample LP capital accounts
    const mockAccounts: CapitalAccount[] = [
      {
        id: 1,
        lp_id: 1,
        lp_name: 'Smith Family Office',
        total_committed: 10000000,
        total_called: 7500000,
        total_distributed: 2500000,
        current_nav_balance: 8200000,
        ownership_percentage: 15.5,
        unfunded_commitment: 2500000,
        net_investment: 5000000,
        moic: 1.43,
        last_updated: '2025-03-31'
      },
      {
        id: 2,
        lp_id: 2,
        lp_name: 'Johnson Endowment',
        total_committed: 25000000,
        total_called: 18000000,
        total_distributed: 8500000,
        current_nav_balance: 16800000,
        ownership_percentage: 38.7,
        unfunded_commitment: 7000000,
        net_investment: 9500000,
        moic: 1.41,
        last_updated: '2025-03-31'
      },
      {
        id: 3,
        lp_id: 3,
        lp_name: 'Davis Pension Fund',
        total_committed: 15000000,
        total_called: 12000000,
        total_distributed: 4200000,
        current_nav_balance: 11500000,
        ownership_percentage: 23.3,
        unfunded_commitment: 3000000,
        net_investment: 7800000,
        moic: 1.31,
        last_updated: '2025-03-31'
      },
      {
        id: 4,
        lp_id: 4,
        lp_name: 'Anderson Fund of Funds',
        total_committed: 8000000,
        total_called: 5500000,
        total_distributed: 1800000,
        current_nav_balance: 5200000,
        ownership_percentage: 12.4,
        unfunded_commitment: 2500000,
        net_investment: 3700000,
        moic: 1.27,
        last_updated: '2025-03-31'
      },
      {
        id: 5,
        lp_id: 5,
        lp_name: 'Miller Capital Partners',
        total_committed: 6500000,
        total_called: 4800000,
        total_distributed: 1500000,
        current_nav_balance: 4600000,
        ownership_percentage: 10.1,
        unfunded_commitment: 1700000,
        net_investment: 3300000,
        moic: 1.27,
        last_updated: '2025-03-31'
      },
    ];

    setAccounts(mockAccounts);
    setLoading(false);
  };

  const loadLPTransactions = (lp: CapitalAccount) => {
    // MOCKUP: Sample transaction history
    const mockTransactions: CapitalTransaction[] = [
      {
        id: 1,
        date: '2024-01-15',
        transaction_type: 'Capital Call',
        amount: -1500000,
        running_balance: 1500000,
        status: 'Received',
        notice_number: 'CC #12',
        notes: 'Investment in TechCo Series B'
      },
      {
        id: 2,
        date: '2024-03-20',
        transaction_type: 'Distribution',
        amount: 850000,
        running_balance: 650000,
        status: 'Received',
        notice_number: 'DIST #8',
        notes: 'Exit proceeds from HealthTech acquisition'
      },
      {
        id: 3,
        date: '2024-06-10',
        transaction_type: 'Capital Call',
        amount: -2000000,
        running_balance: 2650000,
        status: 'Received',
        notice_number: 'CC #13',
        notes: 'Follow-on investment in existing portfolio companies'
      },
      {
        id: 4,
        date: '2024-09-15',
        transaction_type: 'Distribution',
        amount: 1200000,
        running_balance: 1450000,
        status: 'Received',
        notice_number: 'DIST #9',
        notes: 'Partial exit from FinTech Inc'
      },
      {
        id: 5,
        date: '2024-12-20',
        transaction_type: 'Capital Call',
        amount: -1800000,
        running_balance: 3250000,
        status: 'Pending',
        notice_number: 'CC #14',
        notes: 'New investments - Q4 2024 deployment'
      },
    ];

    setTransactions(mockTransactions);
    setSelectedLP(lp);
    setViewMode('detail');
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const formatMultiple = (value: number): string => {
    return `${value.toFixed(2)}x`;
  };

  const getTotalMetrics = () => {
    return {
      total_committed: accounts.reduce((sum, acc) => sum + acc.total_committed, 0),
      total_called: accounts.reduce((sum, acc) => sum + acc.total_called, 0),
      total_distributed: accounts.reduce((sum, acc) => sum + acc.total_distributed, 0),
      total_nav: accounts.reduce((sum, acc) => sum + acc.current_nav_balance, 0),
      lp_count: accounts.length,
    };
  };

  if (loading) {
    return <div className="lp-accounts-page"><div className="loading-state">Loading LP data...</div></div>;
  }

  const totals = getTotalMetrics();

  return (
    <div className="lp-accounts-page">
      {viewMode === 'list' ? (
        <>
          {/* Page Header */}
          <div className="page-header">
            <div className="header-content">
              <h1>Limited Partner Capital Accounts</h1>
              <p className="page-subtitle">Track LP commitments, capital calls, and distributions</p>
            </div>
            <div className="header-actions">
              <button className="btn-secondary">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                </svg>
                Add LP
              </button>
              <button className="btn-primary">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                </svg>
                Create Capital Notice
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-label">Total LPs</div>
              <div className="card-value">{totals.lp_count}</div>
              <div className="card-subtitle">Active investors</div>
            </div>
            <div className="summary-card primary">
              <div className="card-label">Total Commitments</div>
              <div className="card-value">{formatCurrency(totals.total_committed)}</div>
              <div className="card-subtitle">Across all LPs</div>
            </div>
            <div className="summary-card">
              <div className="card-label">Total Called</div>
              <div className="card-value">{formatCurrency(totals.total_called)}</div>
              <div className="card-subtitle">{formatPercent((totals.total_called / totals.total_committed) * 100)} of commitments</div>
            </div>
            <div className="summary-card highlight">
              <div className="card-label">Total Distributed</div>
              <div className="card-value">{formatCurrency(totals.total_distributed)}</div>
              <div className="card-subtitle">Returned to LPs</div>
            </div>
            <div className="summary-card">
              <div className="card-label">Current NAV</div>
              <div className="card-value">{formatCurrency(totals.total_nav)}</div>
              <div className="card-subtitle">Aggregate LP value</div>
            </div>
          </div>

          {/* LP Capital Accounts Table */}
          <div className="section-card">
            <div className="section-header">
              <h2>LP Capital Accounts</h2>
              <div className="section-actions">
                <button className="btn-link">Export to Excel</button>
              </div>
            </div>

            <div className="table-container">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>LP Name</th>
                    <th>Ownership %</th>
                    <th>Committed</th>
                    <th>Called</th>
                    <th>Distributed</th>
                    <th>Current NAV</th>
                    <th>Unfunded</th>
                    <th>MOIC</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} onClick={() => loadLPTransactions(account)} className="clickable-row">
                      <td className="lp-name">{account.lp_name}</td>
                      <td>{formatPercent(account.ownership_percentage)}</td>
                      <td>{formatCurrency(account.total_committed)}</td>
                      <td>{formatCurrency(account.total_called)}</td>
                      <td className="distribution">{formatCurrency(account.total_distributed)}</td>
                      <td className="nav">{formatCurrency(account.current_nav_balance)}</td>
                      <td>{formatCurrency(account.unfunded_commitment)}</td>
                      <td className="performance">{formatMultiple(account.moic)}</td>
                      <td>
                        <button className="btn-icon" title="View Details">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                            <path d="M1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* LP Detail View */}
          <div className="page-header">
            <div className="header-content">
              <button className="btn-back" onClick={() => setViewMode('list')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
                </svg>
                Back to All LPs
              </button>
              <h1>{selectedLP?.lp_name}</h1>
              <p className="page-subtitle">Capital Account Summary • Last Updated: {selectedLP?.last_updated}</p>
            </div>
            <div className="header-actions">
              <button className="btn-secondary">Download Statement</button>
              <button className="btn-secondary">Send Notice</button>
              <button className="btn-primary">Update Balance</button>
            </div>
          </div>

          {/* LP Metrics */}
          {selectedLP && (
            <>
              <div className="detail-metrics">
                <div className="metric-card">
                  <div className="metric-label">Ownership</div>
                  <div className="metric-value-large">{formatPercent(selectedLP.ownership_percentage)}</div>
                  <div className="metric-subtitle">of fund</div>
                </div>
                <div className="metric-card primary">
                  <div className="metric-label">Commitment</div>
                  <div className="metric-value-large">{formatCurrency(selectedLP.total_committed)}</div>
                  <div className="metric-subtitle">Total committed capital</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Capital Called</div>
                  <div className="metric-value-large">{formatCurrency(selectedLP.total_called)}</div>
                  <div className="metric-subtitle">{formatPercent((selectedLP.total_called / selectedLP.total_committed) * 100)} of commitment</div>
                </div>
                <div className="metric-card highlight">
                  <div className="metric-label">Distributions</div>
                  <div className="metric-value-large">{formatCurrency(selectedLP.total_distributed)}</div>
                  <div className="metric-subtitle">Total returned</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Current NAV</div>
                  <div className="metric-value-large">{formatCurrency(selectedLP.current_nav_balance)}</div>
                  <div className="metric-subtitle">Unrealized value</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Unfunded</div>
                  <div className="metric-value-large">{formatCurrency(selectedLP.unfunded_commitment)}</div>
                  <div className="metric-subtitle">Remaining commitment</div>
                </div>
                <div className="metric-card performance">
                  <div className="metric-label">MOIC</div>
                  <div className="metric-value-large">{formatMultiple(selectedLP.moic)}</div>
                  <div className="metric-subtitle">Multiple on invested capital</div>
                </div>
              </div>

              {/* Capital Account Waterfall */}
              <div className="section-card">
                <h2>Capital Account Waterfall</h2>
                <div className="waterfall-visual">
                  <div className="waterfall-row">
                    <div className="waterfall-label">Commitment</div>
                    <div className="waterfall-bar commitment" style={{width: '100%'}}>
                      {formatCurrency(selectedLP.total_committed)}
                    </div>
                  </div>
                  <div className="waterfall-row">
                    <div className="waterfall-label">Called</div>
                    <div className="waterfall-bar called" style={{width: `${(selectedLP.total_called / selectedLP.total_committed) * 100}%`}}>
                      {formatCurrency(selectedLP.total_called)}
                    </div>
                  </div>
                  <div className="waterfall-row">
                    <div className="waterfall-label">Distributed</div>
                    <div className="waterfall-bar distributed" style={{width: `${(selectedLP.total_distributed / selectedLP.total_committed) * 100}%`}}>
                      {formatCurrency(selectedLP.total_distributed)}
                    </div>
                  </div>
                  <div className="waterfall-row">
                    <div className="waterfall-label">Current NAV</div>
                    <div className="waterfall-bar nav" style={{width: `${(selectedLP.current_nav_balance / selectedLP.total_committed) * 100}%`}}>
                      {formatCurrency(selectedLP.current_nav_balance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div className="section-card">
                <div className="section-header">
                  <h2>Transaction History</h2>
                  <div className="section-actions">
                    <button className="btn-link">Export Transactions</button>
                  </div>
                </div>

                <div className="table-container">
                  <table className="transactions-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Notice #</th>
                        <th>Amount</th>
                        <th>Running Balance</th>
                        <th>Status</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn) => (
                        <tr key={txn.id}>
                          <td>{new Date(txn.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`transaction-type ${txn.transaction_type === 'Capital Call' ? 'call' : 'distribution'}`}>
                              {txn.transaction_type}
                            </span>
                          </td>
                          <td className="notice-number">{txn.notice_number}</td>
                          <td className={txn.transaction_type === 'Capital Call' ? 'amount-call' : 'amount-distribution'}>
                            {txn.transaction_type === 'Capital Call' ? '-' : '+'}{formatCurrency(txn.amount)}
                          </td>
                          <td>{formatCurrency(txn.running_balance)}</td>
                          <td>
                            <span className={`status-badge ${txn.status.toLowerCase()}`}>
                              {txn.status}
                            </span>
                          </td>
                          <td className="notes">{txn.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default LPCapitalAccounts;
