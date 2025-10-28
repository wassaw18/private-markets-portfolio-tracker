/**
 * Navigation Configuration
 * Defines which navigation tabs are visible for each account type and role
 */

import { AccountType, UserRole } from '../types/auth';

export interface NavItem {
  path: string;
  label: string;
  accountTypes: AccountType[];  // Which account types can see this tab
  excludedRoles?: UserRole[];   // Which roles CANNOT see this tab (optional)
  requiredRoles?: UserRole[];   // If specified, ONLY these roles can see this tab (overrides excludedRoles)
  children?: NavItem[];          // Optional child items for dropdown menus
}

/**
 * Navigation configuration for all tabs
 * Each tab specifies which account types can access it
 * If excludedRoles is specified, those roles won't see the tab even if account type matches
 */
export const navigationConfig: NavItem[] = [
  // LP Portal - Only for LP_CLIENT users
  {
    path: '/lp-portal',
    label: 'LP Portal',
    accountTypes: ['FUND_MANAGER'],
    requiredRoles: ['LP_CLIENT']
  },

  // Dashboard - Individual & Family Office only
  {
    path: '/dashboard',
    label: 'Dashboard',
    accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE']
  },

  // Fund Manager Dashboard - Fund Managers only (except LP_CLIENT role)
  {
    path: '/fund-dashboard',
    label: 'Fund Manager',
    accountTypes: ['FUND_MANAGER'],
    excludedRoles: ['LP_CLIENT']
  },

  // LP Accounts - Fund Managers only (except LP_CLIENT role)
  {
    path: '/lp-accounts',
    label: 'LP Accounts',
    accountTypes: ['FUND_MANAGER'],
    excludedRoles: ['LP_CLIENT']
  },

  // Holdings - All account types except LP_CLIENT
  {
    path: '/holdings',
    label: 'Holdings',
    accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER'],
    excludedRoles: ['LP_CLIENT']
  },

  // Analytics - All account types except LP_CLIENT
  {
    path: '/visuals',
    label: 'Analytics',
    accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER'],
    excludedRoles: ['LP_CLIENT']
  },

  // Cash Flows - All account types except LP_CLIENT
  {
    path: '/liquidity',
    label: 'Cash Flows',
    accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER'],
    excludedRoles: ['LP_CLIENT']
  },

  // Entities - All account types except LP_CLIENT
  {
    path: '/entities',
    label: 'Entities',
    accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER'],
    excludedRoles: ['LP_CLIENT']
  },

  // Benchmarks - All account types except LP_CLIENT
  {
    path: '/benchmarks',
    label: 'Benchmarks',
    accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER'],
    excludedRoles: ['LP_CLIENT']
  },

  // Reports - All account types (content will be filtered internally)
  {
    path: '/reports',
    label: 'Reports',
    accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER']
  },

  // Operations - Dropdown menu with Documents and Tax Tracking
  {
    path: '/operations',
    label: 'Operations',
    accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER'],
    children: [
      {
        path: '/documents',
        label: 'Documents',
        accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER']
      },
      {
        path: '/tax-tracking',
        label: 'Tax Tracking',
        accountTypes: ['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER']
      }
    ]
  }
];

/**
 * Helper function to determine if a user should see a specific nav item
 */
export const shouldShowNavItem = (
  item: NavItem,
  accountType: AccountType | null,
  userRole: UserRole
): boolean => {
  // If no account type, don't show anything
  if (!accountType) return false;

  // Check if account type is allowed
  if (!item.accountTypes.includes(accountType)) return false;

  // If requiredRoles is specified, ONLY those roles can see this item
  if (item.requiredRoles) {
    return item.requiredRoles.includes(userRole);
  }

  // Check if role is explicitly excluded
  if (item.excludedRoles && item.excludedRoles.includes(userRole)) return false;

  return true;
};

/**
 * Get filtered navigation items for a specific user
 */
export const getFilteredNavigation = (
  accountType: AccountType | null,
  userRole: UserRole
): NavItem[] => {
  return navigationConfig.filter(item =>
    shouldShowNavItem(item, accountType, userRole)
  );
};
