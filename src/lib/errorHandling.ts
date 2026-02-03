/**
 * Safe error message utility for user-facing error notifications.
 * 
 * SECURITY: This utility maps database and API errors to safe user messages
 * to prevent information leakage about database schema, queries, and internal
 * application structure.
 * 
 * Raw error details should only be logged to console for debugging.
 */

/**
 * Maps a database/API error to a safe user-friendly message.
 * Never exposes raw error messages that could reveal schema information.
 * 
 * @param error - The error object from a database or API operation
 * @returns A safe, user-friendly error message
 */
export function getSafeErrorMessage(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();
  
  // Duplicate/unique constraint violations
  if (message.includes('duplicate key') || message.includes('already exists') || message.includes('unique constraint')) {
    return 'This record already exists. Please check for duplicates.';
  }
  
  // Foreign key constraint violations (record in use)
  if (message.includes('foreign key') || message.includes('still referenced') || message.includes('violates foreign key constraint')) {
    return 'Cannot complete this action - the record is being used by other data.';
  }
  
  // RLS policy violations (permission denied)
  if (message.includes('row-level security') || message.includes('permission denied') || message.includes('rls')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Check constraint violations (validation errors)
  if (message.includes('violates check constraint') || message.includes('check constraint')) {
    return 'The provided data does not meet the required format or limits.';
  }
  
  // Not found errors
  if (message.includes('not found') || message.includes('does not exist') || message.includes('no rows')) {
    return 'The requested resource was not found.';
  }
  
  // Invalid input/type errors
  if (message.includes('invalid input') || message.includes('invalid format') || message.includes('invalid')) {
    return 'Invalid data provided. Please check your input.';
  }
  
  // Network/connection errors
  if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  // Authentication errors (handled separately in Auth.tsx for more specific messages)
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  
  if (message.includes('email not confirmed')) {
    return 'Please verify your email before signing in.';
  }
  
  if (message.includes('user already registered')) {
    return 'An account with this email already exists.';
  }
  
  // Generic fallback - never expose raw message
  return 'An error occurred. Please try again or contact support if this persists.';
}

/**
 * Extracts the error message string from various error formats.
 */
function getErrorMessage(error: unknown): string {
  if (!error) return '';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  
  return String(error);
}

/**
 * Logs error details to console for debugging while keeping user messages safe.
 * Use this pattern: console.error for debugging + getSafeErrorMessage for user display.
 * 
 * @param context - Description of what operation failed
 * @param error - The raw error object
 */
export function logError(context: string, error: unknown): void {
  // In production, consider sending to a logging service instead of console
  console.error(`[${context}]`, error);
}
