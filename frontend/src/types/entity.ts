// Entity and Family Member Types

export enum EntityType {
  INDIVIDUAL = "Individual",
  TRUST = "Trust",
  LLC = "LLC",
  PARTNERSHIP = "Partnership",
  CORPORATION = "Corporation",
  FOUNDATION = "Foundation",
  OTHER = "Other"
}

export enum RelationshipType {
  SELF = "Self",
  SPOUSE = "Spouse",
  CHILD = "Child",
  PARENT = "Parent",
  SIBLING = "Sibling",
  TRUSTEE = "Trustee",
  BENEFICIARY = "Beneficiary",
  MANAGER = "Manager",
  MEMBER = "Member",
  PARTNER = "Partner",
  OTHER = "Other"
}

export interface Entity {
  id: number;
  uuid: string;
  name: string;
  entity_type: EntityType;
  tax_id?: string;
  legal_address?: string;
  formation_date?: string;
  is_active: boolean;
  notes?: string;
  created_date?: string;
  updated_date?: string;
}

export interface EntityCreate {
  name: string;
  entity_type: EntityType;
  tax_id?: string;
  legal_address?: string;
  formation_date?: string;
  is_active?: boolean;
  notes?: string;
}

export interface EntityUpdate {
  name?: string;
  entity_type?: EntityType;
  tax_id?: string;
  legal_address?: string;
  formation_date?: string;
  is_active?: boolean;
  notes?: string;
}

export interface FamilyMember {
  id: number;
  entity_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth?: string;
  relationship_type: RelationshipType;
  primary_contact: boolean;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  notes?: string;
  created_date?: string;
  updated_date?: string;
}

export interface FamilyMemberCreate {
  entity_id: number;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  relationship_type: RelationshipType;
  primary_contact?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  is_active?: boolean;
  notes?: string;
}

export interface FamilyMemberUpdate {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  relationship_type?: RelationshipType;
  primary_contact?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  is_active?: boolean;
  notes?: string;
}

export interface EntityWithMembers extends Entity {
  family_members: FamilyMember[];
  investment_count: number;
  total_commitment: number;
}

// Entity-based filter options
export interface EntityFilterOptions {
  entity_types: string[];
  entity_names: string[];
}

// Relationship Categories
export enum RelationshipCategory {
  FAMILY = "Family",
  BUSINESS = "Business",
  TRUST = "Trust",
  PROFESSIONAL = "Professional",
  OTHER = "Other"
}

// Family Relationship Types
export enum FamilyRelationshipType {
  SELF = "Self",
  SPOUSE = "Spouse",
  DOMESTIC_PARTNER = "Domestic Partner",
  CHILD = "Child",
  ADOPTED_CHILD = "Adopted Child",
  STEPCHILD = "Stepchild",
  PARENT = "Parent",
  ADOPTIVE_PARENT = "Adoptive Parent",
  STEPPARENT = "Stepparent",
  GRANDPARENT = "Grandparent",
  GRANDCHILD = "Grandchild",
  SIBLING = "Sibling",
  HALF_SIBLING = "Half Sibling",
  STEPSIBLING = "Stepsibling",
  AUNT_UNCLE = "Aunt/Uncle",
  NIECE_NEPHEW = "Niece/Nephew",
  COUSIN = "Cousin",
  IN_LAW = "In-law",
  GUARDIAN = "Guardian",
  WARD = "Ward",
  OTHER_RELATIVE = "Other Relative"
}

// Business Relationship Types
export enum BusinessRelationshipType {
  OWNER = "Owner",
  CO_OWNER = "Co-Owner",
  SHAREHOLDER = "Shareholder",
  MAJORITY_SHAREHOLDER = "Majority Shareholder",
  MINORITY_SHAREHOLDER = "Minority Shareholder",
  PREFERRED_SHAREHOLDER = "Preferred Shareholder",
  COMMON_SHAREHOLDER = "Common Shareholder",
  VOTING_SHAREHOLDER = "Voting Shareholder",
  NON_VOTING_SHAREHOLDER = "Non-Voting Shareholder",
  MEMBER = "Member",
  MANAGING_MEMBER = "Managing Member",
  NON_MANAGING_MEMBER = "Non-Managing Member",
  GENERAL_PARTNER = "General Partner",
  LIMITED_PARTNER = "Limited Partner",
  MANAGING_PARTNER = "Managing Partner",
  BOARD_MEMBER = "Board Member",
  BOARD_CHAIR = "Board Chair",
  INDEPENDENT_DIRECTOR = "Independent Director",
  EXECUTIVE_DIRECTOR = "Executive Director",
  CEO = "CEO",
  CFO = "CFO",
  COO = "COO",
  PRESIDENT = "President",
  VICE_PRESIDENT = "Vice President",
  SECRETARY = "Secretary",
  TREASURER = "Treasurer",
  OFFICER = "Officer",
  MANAGER = "Manager",
  FOUNDER = "Founder",
  CO_FOUNDER = "Co-Founder",
  INVESTOR = "Investor",
  CREDITOR = "Creditor",
  SUBSIDIARY = "Subsidiary",
  PARENT_COMPANY = "Parent Company"
}

// Trust Relationship Types
export enum TrustRelationshipType {
  GRANTOR = "Grantor",
  SETTLOR = "Settlor",
  TRUSTOR = "Trustor",
  TRUSTEE = "Trustee",
  CO_TRUSTEE = "Co-Trustee",
  SUCCESSOR_TRUSTEE = "Successor Trustee",
  INITIAL_TRUSTEE = "Initial Trustee",
  CORPORATE_TRUSTEE = "Corporate Trustee",
  INDIVIDUAL_TRUSTEE = "Individual Trustee",
  BENEFICIARY = "Beneficiary",
  PRIMARY_BENEFICIARY = "Primary Beneficiary",
  CONTINGENT_BENEFICIARY = "Contingent Beneficiary",
  INCOME_BENEFICIARY = "Income Beneficiary",
  REMAINDER_BENEFICIARY = "Remainder Beneficiary",
  CURRENT_BENEFICIARY = "Current Beneficiary",
  FUTURE_BENEFICIARY = "Future Beneficiary",
  DISCRETIONARY_BENEFICIARY = "Discretionary Beneficiary",
  MANDATORY_BENEFICIARY = "Mandatory Beneficiary",
  REMAINDERMAN = "Remainderman",
  TRUST_PROTECTOR = "Trust Protector",
  TRUST_ADVISOR = "Trust Advisor",
  DISTRIBUTION_COMMITTEE = "Distribution Committee",
  INVESTMENT_COMMITTEE = "Investment Committee"
}

// Professional Relationship Types
export enum ProfessionalRelationshipType {
  ADVISOR = "Advisor",
  FINANCIAL_ADVISOR = "Financial Advisor",
  INVESTMENT_ADVISOR = "Investment Advisor",
  WEALTH_MANAGER = "Wealth Manager",
  FAMILY_OFFICE = "Family Office",
  ATTORNEY = "Attorney",
  TAX_ATTORNEY = "Tax Attorney",
  ESTATE_ATTORNEY = "Estate Attorney",
  CORPORATE_ATTORNEY = "Corporate Attorney",
  ACCOUNTANT = "Accountant",
  CPA = "CPA",
  TAX_PREPARER = "Tax Preparer",
  AUDITOR = "Auditor",
  CONSULTANT = "Consultant",
  INSURANCE_AGENT = "Insurance Agent",
  BROKER = "Broker",
  BANKER = "Banker",
  CUSTODIAN = "Custodian",
  FIDUCIARY = "Fiduciary",
  AGENT = "Agent",
  POWER_OF_ATTORNEY = "Power of Attorney",
  HEALTHCARE_PROXY = "Healthcare Proxy"
}

// Other Relationship Types
export enum OtherRelationshipType {
  NOMINEE = "Nominee",
  PROXY = "Proxy",
  REPRESENTATIVE = "Representative",
  SUCCESSOR = "Successor",
  PREDECESSOR = "Predecessor",
  AFFILIATE = "Affiliate",
  RELATED_PARTY = "Related Party",
  THIRD_PARTY = "Third Party",
  COUNTERPARTY = "Counterparty",
  VENDOR = "Vendor",
  SUPPLIER = "Supplier",
  CUSTOMER = "Customer",
  CLIENT = "Client",
  OTHER = "Other"
}

// Advanced Relationship Types (DEPRECATED - use categorized types above)
export enum AdvancedRelationshipType {
  // Trust relationships
  TRUST_RELATIONSHIP = "Trust Relationship",
  GRANTOR = "Grantor",
  SUCCESSOR_TRUSTEE = "Successor Trustee",
  REMAINDERMAN = "Remainderman",
  PRIMARY_BENEFICIARY = "Primary Beneficiary",
  CONTINGENT_BENEFICIARY = "Contingent Beneficiary",

  // Corporate relationships
  CORPORATE_RELATIONSHIP = "Corporate Relationship",
  SHAREHOLDER = "Shareholder",
  BOARD_MEMBER = "Board Member",
  OFFICER = "Officer",
  MANAGING_MEMBER = "Managing Member",

  // Family relationships
  FAMILY_RELATIONSHIP = "Family Relationship",
  GUARDIAN = "Guardian",
  POWER_OF_ATTORNEY = "Power of Attorney",

  // Ownership relationships
  OWNERSHIP_RELATIONSHIP = "Ownership Relationship",
  VOTING_INTEREST = "Voting Interest",
  NON_VOTING_INTEREST = "Non-Voting Interest",

  // Professional relationships
  PROFESSIONAL_RELATIONSHIP = "Professional Relationship",
  ADVISOR = "Advisor",
  ACCOUNTANT = "Accountant",
  ATTORNEY = "Attorney",

  // Legacy support
  TRUSTEE = "Trustee",
  BENEFICIARY = "Beneficiary",
  MANAGER = "Manager",
  MEMBER = "Member",
  PARTNER = "Partner",
  OTHER = "Other"
}

export enum OwnershipType {
  DIRECT = "Direct",
  INDIRECT = "Indirect",
  BENEFICIAL = "Beneficial",
  FIDUCIARY = "Fiduciary",
  NOMINEE = "Nominee"
}

// Advanced Entity Relationship interfaces
export interface EntityRelationship {
  id: number;
  uuid: string;
  from_entity_id: number;
  to_entity_id: number;
  relationship_category: RelationshipCategory;
  relationship_type: string;
  relationship_subtype?: string;
  percentage_ownership: number;
  is_voting_interest: boolean;
  effective_date?: string;
  end_date?: string;
  is_active: boolean;
  notes?: string;
  created_date: string;
  updated_date: string;
}

export interface EntityRelationshipWithEntities extends EntityRelationship {
  from_entity_name: string;
  from_entity_type: EntityType;
  to_entity_name: string;
  to_entity_type: EntityType;
}

export interface EntityRelationshipCreate {
  from_entity_id: number;
  to_entity_id: number;
  relationship_category: RelationshipCategory;
  relationship_type: string;
  relationship_subtype?: string;
  percentage_ownership?: number;
  is_voting_interest?: boolean;
  effective_date?: string;
  end_date?: string;
  is_active?: boolean;
  notes?: string;
}

export interface EntityRelationshipUpdate {
  relationship_category?: RelationshipCategory;
  relationship_type?: string;
  relationship_subtype?: string;
  percentage_ownership?: number;
  is_voting_interest?: boolean;
  effective_date?: string;
  end_date?: string;
  is_active?: boolean;
  notes?: string;
}

// Investment Ownership interfaces
export interface InvestmentOwnership {
  id: number;
  investment_id: number;
  entity_id: number;
  ownership_percentage: number;
  ownership_type: OwnershipType;
  is_beneficial_owner: boolean;
  effective_date: string;
  end_date?: string;
  notes?: string;
  created_date: string;
  updated_date: string;
}

export interface InvestmentOwnershipWithDetails extends InvestmentOwnership {
  entity_name: string;
  entity_type: EntityType;
  investment_name: string;
  investment_asset_class: string;
}

export interface InvestmentOwnershipCreate {
  investment_id: number;
  entity_id: number;
  ownership_percentage: number;
  ownership_type?: OwnershipType;
  is_beneficial_owner?: boolean;
  effective_date: string;
  end_date?: string;
  notes?: string;
}

export interface InvestmentOwnershipUpdate {
  ownership_percentage?: number;
  ownership_type?: OwnershipType;
  is_beneficial_owner?: boolean;
  effective_date?: string;
  end_date?: string;
  notes?: string;
}

// Entity Hierarchy interfaces
export interface EntityHierarchy {
  id: number;
  entity_id: number;
  parent_entity_id?: number;
  hierarchy_level: number;
  hierarchy_path?: string;
  sort_order: number;
  is_primary_parent: boolean;
  created_date: string;
}

export interface EntityHierarchyNode {
  entity_id: number;
  entity_name: string;
  entity_type: EntityType;
  parent_entity_id?: number;
  hierarchy_level: number;
  children: EntityHierarchyNode[];
  relationship_summary: string;
}

export interface EntityHierarchyCreate {
  entity_id: number;
  parent_entity_id?: number;
  hierarchy_level?: number;
  sort_order?: number;
  is_primary_parent?: boolean;
}

export interface EntityHierarchyUpdate {
  parent_entity_id?: number;
  sort_order?: number;
  is_primary_parent?: boolean;
}

// Complex response interfaces
export interface EntityWithRelationships extends Entity {
  outgoing_relationships: EntityRelationshipWithEntities[];
  incoming_relationships: EntityRelationshipWithEntities[];
  investment_ownerships: InvestmentOwnershipWithDetails[];
  hierarchy_position?: EntityHierarchy;
}

export interface InvestmentWithOwnership {
  id: number;
  name: string;
  // ... other investment fields
  ownership_records: InvestmentOwnershipWithDetails[];
  ownership_validated: boolean;
}

export interface FamilyTreeResponse {
  root_entities: EntityHierarchyNode[];
  orphaned_entities: EntityHierarchyNode[];
  total_entities: number;
  max_hierarchy_depth: number;
}

export interface OwnershipVisualizationData {
  investment_id: number;
  investment_name: string;
  total_commitment: number;
  ownership_breakdown: {
    entity_name: string;
    entity_type: string;
    percentage: number;
    amount: number;
    ownership_type: string;
  }[];
  effective_date: string;
}