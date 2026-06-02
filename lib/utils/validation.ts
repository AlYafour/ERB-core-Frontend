/**
 * Validation utilities for forms
 */

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate required field
 */
export function validateRequired(value: any, fieldName: string): string | null {
  if (value === null || value === undefined || value === '' || value === 0) {
    return `${fieldName} is required. Please enter a valid value.`;
  }
  return null;
}

/**
 * Validate number is positive
 */
export function validatePositiveNumber(value: number, fieldName: string): string | null {
  if (value === null || value === undefined || isNaN(value)) {
    return `${fieldName} must be a valid number.`;
  }
  if (value <= 0) {
    return `${fieldName} must be greater than zero.`;
  }
  return null;
}

/**
 * Validate date is not in the past
 */
export function validateDateNotPast(date: string, fieldName: string): string | null {
  if (!date) return null;
  const dateObj = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj < today) {
    return `${fieldName} cannot be in the past.`;
  }
  return null;
}

/**
 * Validate date is after another date
 */
export function validateDateAfter(
  date: string,
  afterDate: string,
  fieldName: string,
  afterFieldName: string
): string | null {
  if (!date || !afterDate) return null;
  const dateObj = new Date(date);
  const afterDateObj = new Date(afterDate);
  if (dateObj <= afterDateObj) {
    return `${fieldName} must be after ${afterFieldName}.`;
  }
  return null;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): string | null {
  if (!email) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email address. Please enter a valid email.';
  }
  return null;
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): string | null {
  if (!phone) return null;
  const phoneRegex = /^[0-9+\-\s()]+$/;
  if (!phoneRegex.test(phone)) {
    return 'Invalid phone number. Please enter a valid phone number.';
  }
  return null;
}

/**
 * Validate array is not empty
 */
export function validateArrayNotEmpty<T>(array: T[], fieldName: string): string | null {
  if (!array || array.length === 0) {
    return `At least one item must be added to ${fieldName}.`;
  }
  return null;
}

/**
 * Format field name for display
 */
export function formatFieldName(fieldName: string): string {
  const fieldNames: Record<string, string> = {
    supplier_id: 'Supplier',
    product_id: 'Product',
    quantity: 'Quantity',
    unit_price: 'Unit Price',
    order_date: 'Order Date',
    delivery_date: 'Delivery Date',
    quotation_date: 'Quotation Date',
    valid_until: 'Valid Until',
    invoice_date: 'Invoice Date',
    due_date: 'Due Date',
    receipt_date: 'Receipt Date',
    purchase_request_id: 'Purchase Request',
    quotation_request_id: 'Quotation Request',
    purchase_order_id: 'Purchase Order',
    grn_id: 'GRN',
  };
  return fieldNames[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format backend error to user-friendly message
 */
export function formatBackendError(error: any): string {
  if (!error) return 'An unknown error occurred.';
  
  // Handle axios error
  if (error.response) {
    const data = error.response.data;
    
    // Handle Django REST Framework errors
    if (data.detail) {
      return data.detail;
    }
    
    // Handle field errors
    if (typeof data === 'object') {
      const firstError = Object.entries(data)[0];
      if (firstError) {
        const [field, messages] = firstError;
        const fieldName = formatFieldName(field);
        const message = Array.isArray(messages) ? messages[0] : messages;
        return `${fieldName}: ${message}`;
      }
    }
    
    // Handle error message
    if (data.error) {
      return data.error;
    }
    
    if (data.message) {
      return data.message;
    }
  }
  
  // Handle network error
  if (error.message) {
    if (error.message.includes('Network Error')) {
      return 'Network error. Please check your internet connection.';
    }
    return error.message;
  }
  
  return 'An unknown error occurred. Please try again.';
}
