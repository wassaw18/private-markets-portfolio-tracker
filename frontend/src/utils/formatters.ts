/**
 * Shared utility functions for formatting and display
 * Centralized to prevent code duplication across components
 */

/**
 * Format file size in bytes to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format currency amount to USD format
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format currency with decimals for precise amounts
 */
export const formatCurrencyPrecise = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format date string to locale date format
 * Handles timezone properly to prevent off-by-one date issues
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  // Parse as UTC date and format without timezone conversion
  const date = new Date(dateString + 'T00:00:00.000Z');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
};

/**
 * Format date with time
 */
export const formatDateTime = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
};

/**
 * Get today's date in YYYY-MM-DD format for date inputs
 * Returns date in local timezone to match user input expectations
 */
export const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format percentage with specified decimal places
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Format number with thousands separators
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Get entity type icon - centralized to prevent duplication
 */
export const getEntityTypeIcon = (entityType: string): string => {
  const iconMap: { [key: string]: string } = {
    'Individual': '👤',
    'Trust': '🏛️',
    'LLC': '🏢',
    'Partnership': '🤝',
    'Corporation': '🏭',
    'Foundation': '🏛️'
  };
  return iconMap[entityType] || '📋';
};

/**
 * Get file type icon based on MIME type
 */
export const getFileTypeIcon = (mimeType: string): string => {
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📈';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('text')) return '📃';
  return '📎';
};

/**
 * Document category color mapping
 */
export const getDocumentCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    'Capital Call': '#dc3545',
    'Distribution Notice': '#28a745',
    'K-1 Tax Document': '#6f42c1',
    'Quarterly Report': '#007bff',
    'Annual Report': '#20c997',
    'GP Correspondence': '#fd7e14',
    'Financial Statement': '#e83e8c',
    'Legal Document': '#6c757d',
    'Investment Memo': '#17a2b8',
    'Side Letter': '#ffc107',
    'Subscription Document': '#343a40',
    'Other': '#adb5bd'
  };
  return colors[category] || '#6c757d';
};

/**
 * Document status color mapping
 */
export const getDocumentStatusColor = (status: string): string => {
  const colors: { [key: string]: string } = {
    'Pending Review': '#ffc107',
    'Reviewed': '#28a745',
    'Action Required': '#dc3545',
    'Archived': '#6c757d'
  };
  return colors[status] || '#6c757d';
};

/**
 * Asset class color mapping for charts and badges
 */
export const getAssetClassColor = (assetClass: string): string => {
  const colors: { [key: string]: string } = {
    'Private Equity': '#007bff',
    'Private Credit': '#28a745',
    'Real Estate': '#dc3545',
    'Infrastructure': '#ffc107',
    'Hedge Funds': '#6f42c1',
    'Venture Capital': '#17a2b8'
  };
  return colors[assetClass] || '#6c757d';
};

/**
 * Truncate text to specified length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Capitalize first letter of each word
 */
export const titleCase = (text: string): string => {
  return text.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

/**
 * Generate initials from name
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
};

/**
 * Calculate IRR display format (as percentage)
 */
export const formatIRR = (irr?: number): string => {
  if (irr === undefined || irr === null) return 'N/A';
  return formatPercentage(irr, 1);
};

/**
 * Calculate MOIC/TVPI display format
 */
export const formatMultiple = (multiple?: number): string => {
  if (multiple === undefined || multiple === null) return 'N/A';
  return `${multiple.toFixed(2)}x`;
};

/**
 * Format commitment vs called percentage
 */
export const formatCalledPercentage = (called: number, commitment: number): string => {
  if (commitment === 0) return '0%';
  return formatPercentage(called / commitment);
};

/**
 * Get performance indicator color (green for positive, red for negative)
 */
export const getPerformanceColor = (value?: number): string => {
  if (value === undefined || value === null) return '#6c757d';
  if (value > 0) return '#28a745';
  if (value < 0) return '#dc3545';
  return '#ffc107'; // yellow for zero
};

/**
 * Format vintage year display
 */
export const formatVintageYear = (year: number): string => {
  return `${year}`;
};

/**
 * Get relative time string (e.g., "2 days ago")
 */
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};