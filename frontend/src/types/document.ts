// Document management types

// High-level category groups for organizing documents
export enum DocumentCategoryGroup {
  TAX_DOCUMENTS = "TAX_DOCUMENTS",
  NOTICES_AND_STATEMENTS = "NOTICES_AND_STATEMENTS",
  PERFORMANCE = "PERFORMANCE",
  LEGAL_DOCUMENTS = "LEGAL_DOCUMENTS",
  FINANCIAL_STATEMENTS = "FINANCIAL_STATEMENTS",
  INVESTMENT_DOCUMENTS = "INVESTMENT_DOCUMENTS",
  OTHER = "OTHER"
}

// Specific document categories
export enum DocumentCategory {
  // Tax Documents
  K1 = "K-1",
  FORM_1099 = "1099",
  W9 = "W-9",
  W2 = "W-2",
  OTHER_TAX_DOCUMENT = "Other Tax Document",

  // Notices and Statements
  CAPITAL_CALL = "Capital Call",
  DISTRIBUTION_NOTICE = "Distribution Notice",
  CONTRIBUTION_NOTICE = "Contribution Notice",
  RETURN_OF_CAPITAL = "Return of Capital",
  NAV_STATEMENT = "NAV Statement",
  GP_CORRESPONDENCE = "GP Correspondence",
  INVESTOR_UPDATE = "Investor Update",
  NOTICE = "Notice",
  MEETING_MINUTES = "Meeting Minutes",

  // Performance
  PERFORMANCE_REPORT = "Performance Report",

  // Legal Documents
  LEGAL_DOCUMENT = "Legal Document",
  SIDE_LETTER = "Side Letter",
  SUBSCRIPTION_DOCUMENT = "Subscription Document",
  PARTNERSHIP_AGREEMENT = "Partnership Agreement",
  OPERATING_AGREEMENT = "Operating Agreement",
  AMENDMENT = "Amendment",

  // Financial Statements
  FINANCIAL_STATEMENT = "Financial Statement",
  AUDITED_FINANCIALS = "Audited Financials",
  BALANCE_SHEET = "Balance Sheet",
  INCOME_STATEMENT = "Income Statement",
  CASH_FLOW_STATEMENT = "Cash Flow Statement",

  // Investment Documents
  INVESTMENT_MEMO = "Investment Memo",
  DUE_DILIGENCE_REPORT = "Due Diligence Report",
  VALUATION_REPORT = "Valuation Report",
  APPRAISAL = "Appraisal",
  OTHER_DILIGENCE_ITEM = "Other Diligence Item",

  // Other
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
  uuid: string;
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
    uuid: string;
    name: string;
    asset_class: string;
  };
  entity?: {
    id: number;
    uuid: string;
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

// Document metadata interface for category-specific fields
export interface DocumentMetadata {
  // Tax Documents
  tax_year?: string;
  document_type?: string;
  filing_status?: string;
  is_amendment?: boolean;

  // Notices and Statements
  statement_notice_date?: string;
  amount?: string;
  from_sender?: string;
  subject?: string;
  response_required?: boolean;
  response_due_date?: string;

  // Performance
  report_period?: string;
  as_of_date?: string;
  report_type?: string;

  // Legal Documents
  effective_date?: string;
  parties_involved?: string;
  document_version?: string;
  supersedes?: string;

  // Financial Statements
  period_end_date?: string;
  fiscal_year?: string;
  auditor_name?: string;
  audit_status?: string;

  // Investment Documents
  valuation_date?: string;
  prepared_by?: string;
  valuation_method?: string;
  asset_investment_reference?: string;

  // Other
  custom_category?: string;
  document_purpose?: string;
}

// Upload form data interface
export interface DocumentUploadForm {
  file: File | null;
  title: string;
  description: string;
  category: DocumentCategory;
  category_group: DocumentCategoryGroup;
  status: DocumentStatus;
  document_date: string;
  due_date: string;
  investment_id: number | undefined | null;
  entity_id: number | undefined | null;
  is_confidential: boolean;
  uploaded_by: string;
  tags: string;
  document_metadata: DocumentMetadata;
}

// Utility function to get category group from category
export function getCategoryGroup(category: DocumentCategory): DocumentCategoryGroup {
  const categoryGroupMap: Record<DocumentCategory, DocumentCategoryGroup> = {
    // Tax Documents
    [DocumentCategory.K1]: DocumentCategoryGroup.TAX_DOCUMENTS,
    [DocumentCategory.FORM_1099]: DocumentCategoryGroup.TAX_DOCUMENTS,
    [DocumentCategory.W9]: DocumentCategoryGroup.TAX_DOCUMENTS,
    [DocumentCategory.W2]: DocumentCategoryGroup.TAX_DOCUMENTS,
    [DocumentCategory.OTHER_TAX_DOCUMENT]: DocumentCategoryGroup.TAX_DOCUMENTS,

    // Notices and Statements
    [DocumentCategory.CAPITAL_CALL]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,
    [DocumentCategory.DISTRIBUTION_NOTICE]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,
    [DocumentCategory.CONTRIBUTION_NOTICE]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,
    [DocumentCategory.RETURN_OF_CAPITAL]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,
    [DocumentCategory.NAV_STATEMENT]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,
    [DocumentCategory.GP_CORRESPONDENCE]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,
    [DocumentCategory.INVESTOR_UPDATE]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,
    [DocumentCategory.NOTICE]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,
    [DocumentCategory.MEETING_MINUTES]: DocumentCategoryGroup.NOTICES_AND_STATEMENTS,

    // Performance
    [DocumentCategory.PERFORMANCE_REPORT]: DocumentCategoryGroup.PERFORMANCE,

    // Legal Documents
    [DocumentCategory.LEGAL_DOCUMENT]: DocumentCategoryGroup.LEGAL_DOCUMENTS,
    [DocumentCategory.SIDE_LETTER]: DocumentCategoryGroup.LEGAL_DOCUMENTS,
    [DocumentCategory.SUBSCRIPTION_DOCUMENT]: DocumentCategoryGroup.LEGAL_DOCUMENTS,
    [DocumentCategory.PARTNERSHIP_AGREEMENT]: DocumentCategoryGroup.LEGAL_DOCUMENTS,
    [DocumentCategory.OPERATING_AGREEMENT]: DocumentCategoryGroup.LEGAL_DOCUMENTS,
    [DocumentCategory.AMENDMENT]: DocumentCategoryGroup.LEGAL_DOCUMENTS,

    // Financial Statements
    [DocumentCategory.FINANCIAL_STATEMENT]: DocumentCategoryGroup.FINANCIAL_STATEMENTS,
    [DocumentCategory.AUDITED_FINANCIALS]: DocumentCategoryGroup.FINANCIAL_STATEMENTS,
    [DocumentCategory.BALANCE_SHEET]: DocumentCategoryGroup.FINANCIAL_STATEMENTS,
    [DocumentCategory.INCOME_STATEMENT]: DocumentCategoryGroup.FINANCIAL_STATEMENTS,
    [DocumentCategory.CASH_FLOW_STATEMENT]: DocumentCategoryGroup.FINANCIAL_STATEMENTS,

    // Investment Documents
    [DocumentCategory.INVESTMENT_MEMO]: DocumentCategoryGroup.INVESTMENT_DOCUMENTS,
    [DocumentCategory.DUE_DILIGENCE_REPORT]: DocumentCategoryGroup.INVESTMENT_DOCUMENTS,
    [DocumentCategory.VALUATION_REPORT]: DocumentCategoryGroup.INVESTMENT_DOCUMENTS,
    [DocumentCategory.APPRAISAL]: DocumentCategoryGroup.INVESTMENT_DOCUMENTS,
    [DocumentCategory.OTHER_DILIGENCE_ITEM]: DocumentCategoryGroup.INVESTMENT_DOCUMENTS,

    // Other
    [DocumentCategory.OTHER]: DocumentCategoryGroup.OTHER,
  };

  return categoryGroupMap[category] || DocumentCategoryGroup.OTHER;
}