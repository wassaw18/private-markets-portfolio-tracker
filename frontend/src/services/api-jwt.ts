/**
 * JWT-aware API service for multi-tenant application
 * Automatically includes Bearer tokens and handles token refresh
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Investment, InvestmentCreate, InvestmentUpdate, CashFlow, CashFlowCreate, CashFlowUpdate, Valuation, ValuationCreate, ValuationUpdate, InvestmentPerformance, PortfolioPerformance, CommitmentVsCalledData, AssetAllocationData, VintageAllocationData, TimelineDataPoint, JCurveDataPoint, DashboardSummaryStats } from '../types/investment';
import { Entity, EntityCreate, EntityUpdate, EntityWithMembers, FamilyMember, FamilyMemberCreate, FamilyMemberUpdate } from '../types/entity';
import { Document, DocumentCreate, DocumentUpdate, DocumentUploadForm, DocumentFilters, DocumentSearchResult, DocumentStatistics, DocumentTag, DocumentTagCreate } from '../types/document';
import { authAPI } from './authApi';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://172.23.5.82:8000';

// Filter interfaces (keeping existing ones)
export interface InvestmentFilters {
  search?: string;
  asset_classes?: string[];
  min_vintage_year?: number;
  max_vintage_year?: number;
  min_commitment?: number;
  max_commitment?: number;
  entity_ids?: number[];
  entity_names?: string[];
  entity_types?: string[];
}

export interface FilterOptions {
  asset_classes: string[];
  entity_types: string[];
  entity_names: string[];
  vintage_year_range: {
    min: number;
    max: number;
  };
  commitment_range: {
    min: number;
    max: number;
  };
}

export interface BulkUploadResult {
  filename: string;
  success_count: number;
  error_count: number;
  warning_count: number;
  errors: Array<{row: number; message: string}>;
  warnings: Array<{row: number; message: string}>;
  message: string;
}

class JWTApiService {
  private axiosInstance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
  }> = [];

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue this request
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(() => {
              return this.axiosInstance(originalRequest);
            }).catch(err => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await authAPI.refreshToken(refreshToken);

            // Update stored tokens
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('refresh_token', response.refresh_token);
            localStorage.setItem('auth_user', JSON.stringify(response.user));
            localStorage.setItem('token_expires_at', (Date.now() + response.expires_in * 1000).toString());

            // Process failed queue
            this.failedQueue.forEach(({ resolve }) => {
              resolve();
            });
            this.failedQueue = [];

            // Retry original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${response.access_token}`;
            return this.axiosInstance(originalRequest);

          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.failedQueue.forEach(({ reject }) => {
              reject(refreshError);
            });
            this.failedQueue = [];

            // Clear tokens and redirect to login
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('auth_user');
            localStorage.removeItem('token_expires_at');

            // Dispatch logout event
            window.dispatchEvent(new CustomEvent('auth:logout'));

            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Investment API methods
  async getInvestments(skip: number = 0, limit: number = 1000): Promise<Investment[]> {
    const response = await this.axiosInstance.get('/api/investments', {
      params: { skip, limit }
    });
    return response.data;
  }

  async getInvestment(id: number): Promise<Investment> {
    const response = await this.axiosInstance.get(`/api/investments/${id}`);
    return response.data;
  }

  async createInvestment(investment: InvestmentCreate): Promise<Investment> {
    const response = await this.axiosInstance.post('/api/investments', investment);
    return response.data;
  }

  async updateInvestment(id: number, investment: InvestmentUpdate): Promise<Investment> {
    const response = await this.axiosInstance.put(`/api/investments/${id}`, investment);
    return response.data;
  }

  async deleteInvestment(id: number): Promise<void> {
    await this.axiosInstance.delete(`/api/investments/${id}`);
  }

  // Entity API methods
  async getEntities(): Promise<EntityWithMembers[]> {
    const response = await this.axiosInstance.get('/api/entities');
    return response.data;
  }

  async getEntity(id: number): Promise<EntityWithMembers> {
    const response = await this.axiosInstance.get(`/api/entities/${id}`);
    return response.data;
  }

  async createEntity(entity: EntityCreate): Promise<Entity> {
    const response = await this.axiosInstance.post('/api/entities', entity);
    return response.data;
  }

  async updateEntity(id: number, entity: EntityUpdate): Promise<Entity> {
    const response = await this.axiosInstance.put(`/api/entities/${id}`, entity);
    return response.data;
  }

  async deleteEntity(id: number): Promise<void> {
    await this.axiosInstance.delete(`/api/entities/${id}`);
  }

  // Cash Flow API methods
  async getCashFlows(investmentId?: number, startDate?: string, endDate?: string): Promise<CashFlow[]> {
    const params: any = {};
    if (investmentId) params.investment_id = investmentId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await this.axiosInstance.get('/api/cashflows', { params });
    return response.data;
  }

  async createCashFlow(cashflow: CashFlowCreate): Promise<CashFlow> {
    const response = await this.axiosInstance.post('/api/cashflows', cashflow);
    return response.data;
  }

  async updateCashFlow(id: number, cashflow: CashFlowUpdate): Promise<CashFlow> {
    const response = await this.axiosInstance.put(`/api/cashflows/${id}`, cashflow);
    return response.data;
  }

  async deleteCashFlow(id: number): Promise<void> {
    await this.axiosInstance.delete(`/api/cashflows/${id}`);
  }

  // Valuation API methods
  async getValuations(investmentId?: number): Promise<Valuation[]> {
    const params: any = {};
    if (investmentId) params.investment_id = investmentId;

    const response = await this.axiosInstance.get('/api/valuations', { params });
    return response.data;
  }

  async createValuation(valuation: ValuationCreate): Promise<Valuation> {
    const response = await this.axiosInstance.post('/api/valuations', valuation);
    return response.data;
  }

  async updateValuation(id: number, valuation: ValuationUpdate): Promise<Valuation> {
    const response = await this.axiosInstance.put(`/api/valuations/${id}`, valuation);
    return response.data;
  }

  async deleteValuation(id: number): Promise<void> {
    await this.axiosInstance.delete(`/api/valuations/${id}`);
  }

  // Dashboard API methods
  async getDashboardSummary(): Promise<any> {
    const response = await this.axiosInstance.get('/api/dashboard/summary');
    return response.data;
  }

  async getAssetClassBreakdown(): Promise<any> {
    const response = await this.axiosInstance.get('/api/dashboard/asset-class-breakdown');
    return response.data;
  }

  async getEntityBreakdown(): Promise<any> {
    const response = await this.axiosInstance.get('/api/dashboard/entity-breakdown');
    return response.data;
  }

  // Tenant stats
  async getTenantStats(): Promise<any> {
    const response = await this.axiosInstance.get('/api/tenant/stats');
    return response.data;
  }

  // Generic API method for custom requests
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.request(config);
    return response.data;
  }

  // Get the axios instance for custom requests
  getInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

// Create and export the API instance
export const jwtAPI = new JWTApiService();
export default jwtAPI;

// For backwards compatibility, export some of the original API methods
export const investmentAPI = {
  getInvestments: jwtAPI.getInvestments.bind(jwtAPI),
  getInvestment: jwtAPI.getInvestment.bind(jwtAPI),
  createInvestment: jwtAPI.createInvestment.bind(jwtAPI),
  updateInvestment: jwtAPI.updateInvestment.bind(jwtAPI),
  deleteInvestment: jwtAPI.deleteInvestment.bind(jwtAPI),
};

export const entityAPI = {
  getEntities: jwtAPI.getEntities.bind(jwtAPI),
  getEntity: jwtAPI.getEntity.bind(jwtAPI),
  createEntity: jwtAPI.createEntity.bind(jwtAPI),
  updateEntity: jwtAPI.updateEntity.bind(jwtAPI),
  deleteEntity: jwtAPI.deleteEntity.bind(jwtAPI),
};

export const cashFlowAPI = {
  getCashFlows: jwtAPI.getCashFlows.bind(jwtAPI),
  createCashFlow: jwtAPI.createCashFlow.bind(jwtAPI),
  updateCashFlow: jwtAPI.updateCashFlow.bind(jwtAPI),
  deleteCashFlow: jwtAPI.deleteCashFlow.bind(jwtAPI),
};

export const valuationAPI = {
  getValuations: jwtAPI.getValuations.bind(jwtAPI),
  createValuation: jwtAPI.createValuation.bind(jwtAPI),
  updateValuation: jwtAPI.updateValuation.bind(jwtAPI),
  deleteValuation: jwtAPI.deleteValuation.bind(jwtAPI),
};