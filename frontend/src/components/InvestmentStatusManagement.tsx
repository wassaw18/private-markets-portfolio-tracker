import React, { useState } from 'react';
import { InvestmentStatus, Investment } from '../types/investment';

interface InvestmentStatusManagementProps {
  investment: Investment;
  onStatusUpdate: (investmentId: number, status: InvestmentStatus, password: string, realizationDate?: string, realizationNotes?: string) => Promise<void>;
}

const InvestmentStatusManagement: React.FC<InvestmentStatusManagementProps> = ({
  investment,
  onStatusUpdate
}) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<InvestmentStatus | null>(null);
  const [password, setPassword] = useState('');
  const [realizationDate, setRealizationDate] = useState('');
  const [realizationNotes, setRealizationNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatusColor = (status: InvestmentStatus) => {
    switch (status) {
      case InvestmentStatus.ACTIVE:
        return 'text-green-600 bg-green-100';
      case InvestmentStatus.DORMANT:
        return 'text-yellow-600 bg-yellow-100';
      case InvestmentStatus.REALIZED:
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

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

  const handleStatusChange = (newStatus: InvestmentStatus) => {
    if (newStatus === InvestmentStatus.REALIZED) {
      setPendingStatus(newStatus);
      setShowPasswordModal(true);
      setPassword('');
      setRealizationDate('');
      setRealizationNotes('');
      setError(null);
    } else {
      // For non-realized status changes, update immediately without password
      handleConfirmStatusUpdate(newStatus, '', '', '');
    }
  };

  const handleConfirmStatusUpdate = async (
    status: InvestmentStatus,
    passwordValue: string,
    realizationDateValue: string,
    realizationNotesValue: string
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await onStatusUpdate(
        investment.id,
        status,
        passwordValue,
        realizationDateValue || undefined,
        realizationNotesValue || undefined
      );
      
      setShowPasswordModal(false);
      setPendingStatus(null);
      setPassword('');
      setRealizationDate('');
      setRealizationNotes('');
    } catch (err: any) {
      setError(err.message || 'Failed to update investment status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitPasswordModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingStatus) {
      handleConfirmStatusUpdate(pendingStatus, password, realizationDate, realizationNotes);
    }
  };

  const handleCancelPasswordModal = () => {
    setShowPasswordModal(false);
    setPendingStatus(null);
    setPassword('');
    setRealizationDate('');
    setRealizationNotes('');
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Investment Status</h3>
      
      {/* Current Status Display */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Current Status:</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(investment.status)}`}>
            {getStatusLabel(investment.status)}
          </span>
        </div>
        
        {investment.status_changed_by && investment.status_changed_date && (
          <div className="mt-2 text-xs text-gray-500">
            Last updated by {investment.status_changed_by} on {new Date(investment.status_changed_date).toLocaleDateString()}
          </div>
        )}
        
        {investment.realization_date && (
          <div className="mt-1 text-xs text-gray-500">
            Realization Date: {new Date(investment.realization_date).toLocaleDateString()}
          </div>
        )}
        
        {investment.realization_notes && (
          <div className="mt-1 text-xs text-gray-500">
            Notes: {investment.realization_notes}
          </div>
        )}
      </div>

      {/* Status Change Options */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Change Status:</h4>
        
        {Object.values(InvestmentStatus).map((status) => (
          <label key={status} className="flex items-center">
            <input
              type="radio"
              name="investment-status"
              value={status}
              checked={investment.status === status}
              onChange={() => handleStatusChange(status)}
              disabled={isLoading}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">
              {getStatusLabel(status)}
              {status === InvestmentStatus.REALIZED && (
                <span className="text-xs text-red-500 ml-1">(requires password)</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {/* Password Confirmation Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Investment Realization
            </h3>
            
            <form onSubmit={handleSubmitPasswordModal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password Confirmation *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter your password to confirm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Realization Date
                </label>
                <input
                  type="date"
                  value={realizationDate}
                  onChange={(e) => setRealizationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Realization Notes
                </label>
                <textarea
                  value={realizationNotes}
                  onChange={(e) => setRealizationNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Optional notes about the realization..."
                />
              </div>
              
              {error && (
                <div className="text-red-600 text-sm">
                  {error}
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isLoading || !password.trim()}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Updating...' : 'Mark as Realized'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelPasswordModal}
                  disabled={isLoading}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentStatusManagement;