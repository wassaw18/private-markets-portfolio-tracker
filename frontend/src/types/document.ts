// Document management types

export enum DocumentCategory {
  CAPITAL_CALL = "Capital Call",
  DISTRIBUTION_NOTICE = "Distribution Notice",
  K1_TAX_DOCUMENT = "K-1 Tax Document",
  QUARTERLY_REPORT = "Quarterly Report",
  ANNUAL_REPORT = "Annual Report",
  GP_CORRESPONDENCE = "GP Correspondence",
  FINANCIAL_STATEMENT = "Financial Statement",
  LEGAL_DOCUMENT = "Legal Document",
  INVESTMENT_MEMO = "Investment Memo",
  SIDE_LETTER = "Side Letter",
  SUBSCRIPTION_DOCUMENT = "Subscription Document",
  OTHER = "Other"
}

export enum DocumentStatus {
  PENDING_REVIEW = "Pending Review",
  REVIEWED = "Reviewed",
  ACTION_REQUIRED = "Action Required",
  ARCHIVED = "Archived"
}

export interface DocumentTag {
  id: number;
  document_id: number;
  tag_name: string;
  color?: string;
  created_date?: string;
}

export interface DocumentTagCreate {
  tag_name: string;
  color?: string;
}

export interface DocumentBase {
  title: string;
  description?: string;
  category: DocumentCategory;
  status: DocumentStatus;
  document_date?: string;
  due_date?: string;
  investment_id?: number;
  entity_id?: number;
  is_confidential: boolean;
  is_archived: boolean;
  notes?: string;
}

export interface DocumentCreate extends DocumentBase {
  // File information will be added during upload
}

export interface DocumentUpdate {
  title?: string;
  description?: string;
  category?: DocumentCategory;
  status?: DocumentStatus;
  document_date?: string;
  due_date?: string;
  investment_id?: number | null;
  entity_id?: number | null;
  is_confidential?: boolean;
  is_archived?: boolean;
  notes?: string;
}

export interface Document extends DocumentBase {
  id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  file_hash: string;
  searchable_content?: string;
  uploaded_by?: string;
  created_date?: string;
  updated_date?: string;
  
  // Relationships
  investment?: {
    id: number;
    name: string;
    asset_class: string;
  };
  entity?: {
    id: number;
    name: string;
    entity_type: string;
  };
  tags: DocumentTag[];
}

export interface DocumentFilters {
  search?: string;
  categories?: DocumentCategory[];
  statuses?: DocumentStatus[];
  investment_ids?: number[];
  entity_ids?: number[];
  tags?: string[];
  date_from?: string;
  date_to?: string;
  due_date_from?: string;
  due_date_to?: string;
  is_confidential?: boolean;
  is_archived?: boolean;
  uploaded_by?: string;
}

export interface DocumentSearchResult {
  document: Document;
  relevance_score: number;
  highlight_snippets: string[];
}

export interface DocumentStatistics {
  total_documents: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  by_entity: Record<string, number>;
  by_investment: Record<string, number>;
  pending_action_count: number;
  overdue_count: number;
  recent_uploads_count: number;
  total_file_size: number;
}

export interface BulkDocumentOperation {
  document_ids: number[];
  operation: 'archive' | 'unarchive' | 'delete' | 'update_status' | 'add_tags' | 'remove_tags';
  parameters?: Record<string, any>;
}

// Upload form data interface
export interface DocumentUploadForm {
  file: File | null;
  title: string;
  description: string;
  category: DocumentCategory;
  status: DocumentStatus;
  document_date: string;
  due_date: string;
  investment_id: number | undefined | null;
  entity_id: number | undefined | null;
  is_confidential: boolean;
  uploaded_by: string;
  tags: string;
}