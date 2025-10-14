import React, { useState, useEffect } from 'react';
import { InvestmentStatus, Investment } from '../types/investment';

interface InvestmentStatusManagementProps {
  investment: Investment;
  onStatusUpdate: (investmentId: number, status: InvestmentStatus, password: string, realizationDate?: string, realizationNotes?: string) => Promise<void>;
  onClose?: () => void; // Optional callback for when modal is closed
}

const InvestmentStatusManagement: React.FC<InvestmentStatusManagementProps> = ({
  investment,
  onStatusUpdate,
  onClose
}) => {
  const [selectedStatus, setSelectedStatus] = useState<InvestmentStatus>(investment.status);
  const [password, setPassword] = useState('');
  const [realizationDate, setRealizationDate] = useState(investment.realization_date || '');
  const [realizationNotes, setRealizationNotes] = useState(investment.realization_notes || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when investment prop changes
  useEffect(() => {
    setSelectedStatus(investment.status);
    setRealizationDate(investment.realization_date || '');
    setRealizationNotes(investment.realization_notes || '');
  }, [investment.status, investment.realization_date, investment.realization_notes]);

  const getStatusLabel = (status: InvestmentStatus) => {
    switch (status) {
      case InvestmentStatus.ACTIVE:
        return 'Active';
      case InvestmentStatus.DORMANT:
        return 'Dormant';
      case InvestmentStatus.REALIZED:
        return 'Realized';
      default:
        return status;
    }
  };

  const handleCloseStatusModal = () => {
    setSelectedStatus(investment.status);
    setPassword('');
    setError(null);
    if (onClose) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if there are actually changes to make
    if (selectedStatus === investment.status && 
        realizationDate === (investment.realization_date || '') && 
        realizationNotes === (investment.realization_notes || '')) {
      handleCloseStatusModal();
      return;
    }

    // Validate password for REALIZED status
    if (selectedStatus === InvestmentStatus.REALIZED && !password.trim()) {
      setError('Password is required to mark investment as realized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onStatusUpdate(
        investment.id,
        selectedStatus,
        password,
        realizationDate || undefined,
        realizationNotes || undefined
      );
      
      // Close modal on success - the parent component should re-render with updated investment data
      handleCloseStatusModal();
    } catch (error: any) {
      setError(error.message || 'Failed to update investment status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              margin: '0 16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              zIndex: 10000
            }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Update Investment Status</h3>
              <button 
                onClick={handleCloseStatusModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Investment Status</label>
                <div className="space-y-2">
                  {Object.values(InvestmentStatus).map((status) => (
                    <label key={status} className="flex items-center p-2 border rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value={status}
                        checked={selectedStatus === status}
                        onChange={(e) => setSelectedStatus(e.target.value as InvestmentStatus)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{getStatusLabel(status)}</div>
                        <div className="text-xs text-gray-500">
                          {status === InvestmentStatus.ACTIVE && 'Currently active and being tracked'}
                          {status === InvestmentStatus.DORMANT && 'Inactive but may resume activity'}
                          {status === InvestmentStatus.REALIZED && 'Completely finished, no future activity expected'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Realization Details */}
              {selectedStatus === InvestmentStatus.REALIZED && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Realization Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={realizationDate}
                      onChange={(e) => setRealizationDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Realization Notes (Optional)
                    </label>
                    <textarea
                      value={realizationNotes}
                      onChange={(e) => setRealizationNotes(e.target.value)}
                      placeholder="e.g., Fund fully liquidated, final distribution completed"
                      maxLength={500}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Password Confirmation - Required for REALIZED status */}
              {selectedStatus === InvestmentStatus.REALIZED && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password Confirmation <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password to confirm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                    autoComplete="current-password"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Password confirmation is required to mark investments as realized
                  </p>
                </div>
              )}
              
              {/* Password Confirmation - Optional for other status changes */}
              {selectedStatus !== InvestmentStatus.REALIZED && selectedStatus !== investment.status && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password Confirmation (Optional)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="current-password"
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="text-sm text-red-600">{error}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseStatusModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
    </div>
  );
};

export default InvestmentStatusManagement;