/**
 * Comprehensive validation utilities for form inputs
 * Provides type-safe validation without external dependencies
 */

// Base validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Field validation result
export interface FieldValidation {
  field: string;
  isValid: boolean;
  error?: string;
}

// Investment validation schema
export interface InvestmentValidation {
  name: string;
  entity_id: number;
  strategy: string;
  vintage_year: number;
  commitment_amount: number;
  called_amount?: number;
  fees?: number;
}

// Document validation schema
export interface DocumentValidation {
  title: string;
  category: string;
  file: File | null;
  investment_id?: number;
  entity_id?: number;
  document_date?: string;
  due_date?: string;
}

// Entity validation schema
export interface EntityValidation {
  name: string;
  entity_type: string;
  tax_id?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
}

// Family member validation schema
export interface FamilyMemberValidation {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  relationship_type: string;
}

/**
 * Generic field validators
 */
export const validators = {
  required: (value: any, fieldName: string): FieldValidation => ({
    field: fieldName,
    isValid: value !== null && value !== undefined && value !== '' && value !== 0,
    error: value === null || value === undefined || value === '' || value === 0 
      ? `${fieldName} is required` : undefined
  }),

  minLength: (value: string, minLength: number, fieldName: string): FieldValidation => ({
    field: fieldName,
    isValid: value.length >= minLength,
    error: value.length < minLength 
      ? `${fieldName} must be at least ${minLength} characters` : undefined
  }),

  maxLength: (value: string, maxLength: number, fieldName: string): FieldValidation => ({
    field: fieldName,
    isValid: value.length <= maxLength,
    error: value.length > maxLength 
      ? `${fieldName} must be no more than ${maxLength} characters` : undefined
  }),

  email: (value: string, fieldName: string): FieldValidation => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      field: fieldName,
      isValid: !value || emailRegex.test(value), // Optional field
      error: value && !emailRegex.test(value) 
        ? `${fieldName} must be a valid email address` : undefined
    };
  },

  phone: (value: string, fieldName: string): FieldValidation => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return {
      field: fieldName,
      isValid: !value || phoneRegex.test(value.replace(/\D/g, '')), // Optional field
      error: value && !phoneRegex.test(value.replace(/\D/g, '')) 
        ? `${fieldName} must be a valid phone number` : undefined
    };
  },

  positiveNumber: (value: number, fieldName: string): FieldValidation => ({
    field: fieldName,
    isValid: value >= 0,
    error: value < 0 ? `${fieldName} must be a positive number` : undefined
  }),

  year: (value: number, fieldName: string): FieldValidation => {
    const currentYear = new Date().getFullYear();
    const minYear = 1990;
    const maxYear = currentYear + 10;
    return {
      field: fieldName,
      isValid: value >= minYear && value <= maxYear,
      error: (value < minYear || value > maxYear) 
        ? `${fieldName} must be between ${minYear} and ${maxYear}` : undefined
    };
  },

  fileSize: (file: File | null, maxSizeMB: number, fieldName: string): FieldValidation => {
    if (!file) {
      return { field: fieldName, isValid: true };
    }
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return {
      field: fieldName,
      isValid: file.size <= maxSizeBytes,
      error: file.size > maxSizeBytes 
        ? `${fieldName} must be smaller than ${maxSizeMB}MB` : undefined
    };
  },

  fileType: (file: File | null, allowedTypes: string[], fieldName: string): FieldValidation => {
    if (!file) {
      return { field: fieldName, isValid: true };
    }
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    return {
      field: fieldName,
      isValid: allowedTypes.includes(fileExtension || ''),
      error: !allowedTypes.includes(fileExtension || '') 
        ? `${fieldName} must be one of: ${allowedTypes.join(', ')}` : undefined
    };
  },

  dateNotInFuture: (value: string, fieldName: string): FieldValidation => {
    if (!value) {
      return { field: fieldName, isValid: true }; // Optional field
    }
    const inputDate = new Date(value);
    const today = new Date();
    return {
      field: fieldName,
      isValid: inputDate <= today,
      error: inputDate > today ? `${fieldName} cannot be in the future` : undefined
    };
  }
};

/**
 * Investment form validation
 */
export const validateInvestment = (data: InvestmentValidation): ValidationResult => {
  const validations: FieldValidation[] = [
    validators.required(data.name, 'Investment name'),
    validators.minLength(data.name, 2, 'Investment name'),
    validators.maxLength(data.name, 100, 'Investment name'),
    validators.required(data.entity_id, 'Entity'),
    validators.required(data.strategy, 'Strategy'),
    validators.minLength(data.strategy, 2, 'Strategy'),
    validators.maxLength(data.strategy, 200, 'Strategy'),
    validators.required(data.vintage_year, 'Vintage year'),
    validators.year(data.vintage_year, 'Vintage year'),
    validators.required(data.commitment_amount, 'Commitment amount'),
    validators.positiveNumber(data.commitment_amount, 'Commitment amount'),
    ...(data.called_amount !== undefined ? [validators.positiveNumber(data.called_amount, 'Called amount')] : []),
    ...(data.fees !== undefined ? [validators.positiveNumber(data.fees, 'Fees')] : [])
  ];

  // Additional business logic validation
  if (data.called_amount !== undefined && data.called_amount > data.commitment_amount) {
    validations.push({
      field: 'called_amount',
      isValid: false,
      error: 'Called amount cannot exceed commitment amount'
    });
  }

  const errors = validations
    .filter(v => !v.isValid)
    .map(v => v.error!)
    .filter(Boolean);

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Document form validation
 */
export const validateDocument = (data: DocumentValidation): ValidationResult => {
  const validations: FieldValidation[] = [
    validators.required(data.title, 'Title'),
    validators.minLength(data.title, 2, 'Title'),
    validators.maxLength(data.title, 200, 'Title'),
    validators.required(data.category, 'Category'),
    validators.required(data.file, 'File'),
    validators.fileSize(data.file, 50, 'File'), // 50MB max
    validators.fileType(data.file, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'], 'File'),
    ...(data.document_date ? [validators.dateNotInFuture(data.document_date, 'Document date')] : [])
  ];

  // Must be associated with either investment or entity
  if (!data.investment_id && !data.entity_id) {
    validations.push({
      field: 'association',
      isValid: false,
      error: 'Document must be associated with either an investment or entity'
    });
  }

  // Due date cannot be before document date
  if (data.document_date && data.due_date && new Date(data.due_date) < new Date(data.document_date)) {
    validations.push({
      field: 'due_date',
      isValid: false,
      error: 'Due date cannot be before document date'
    });
  }

  const errors = validations
    .filter(v => !v.isValid)
    .map(v => v.error!)
    .filter(Boolean);

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Entity form validation
 */
export const validateEntity = (data: EntityValidation): ValidationResult => {
  const validations: FieldValidation[] = [
    validators.required(data.name, 'Entity name'),
    validators.minLength(data.name, 2, 'Entity name'),
    validators.maxLength(data.name, 100, 'Entity name'),
    validators.required(data.entity_type, 'Entity type'),
    ...(data.contact_email ? [validators.email(data.contact_email, 'Contact email')] : []),
    ...(data.contact_phone ? [validators.phone(data.contact_phone, 'Contact phone')] : [])
  ];

  const errors = validations
    .filter(v => !v.isValid)
    .map(v => v.error!)
    .filter(Boolean);

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Family member form validation
 */
export const validateFamilyMember = (data: FamilyMemberValidation): ValidationResult => {
  const validations: FieldValidation[] = [
    validators.required(data.first_name, 'First name'),
    validators.minLength(data.first_name, 2, 'First name'),
    validators.maxLength(data.first_name, 50, 'First name'),
    validators.required(data.last_name, 'Last name'),
    validators.minLength(data.last_name, 2, 'Last name'),
    validators.maxLength(data.last_name, 50, 'Last name'),
    validators.required(data.relationship_type, 'Relationship type'),
    ...(data.email ? [validators.email(data.email, 'Email')] : []),
    ...(data.phone ? [validators.phone(data.phone, 'Phone')] : [])
  ];

  const errors = validations
    .filter(v => !v.isValid)
    .map(v => v.error!)
    .filter(Boolean);

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Utility to get field-specific error from validation result
 */
export const getFieldError = (validations: FieldValidation[], fieldName: string): string | undefined => {
  return validations.find(v => v.field === fieldName && !v.isValid)?.error;
};

/**
 * Utility to check if a specific field is valid
 */
export const isFieldValid = (validations: FieldValidation[], fieldName: string): boolean => {
  const fieldValidation = validations.find(v => v.field === fieldName);
  return fieldValidation ? fieldValidation.isValid : true;
};