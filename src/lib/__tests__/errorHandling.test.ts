import { describe, it, expect, vi } from 'vitest';
import { getSafeErrorMessage, logError } from '../errorHandling';

describe('getSafeErrorMessage', () => {
  it('maps duplicate key errors', () => {
    expect(getSafeErrorMessage(new Error('duplicate key value violates constraint'))).toBe(
      'This record already exists. Please check for duplicates.'
    );
  });

  it('maps "already exists" errors', () => {
    expect(getSafeErrorMessage('Record already exists in table')).toBe(
      'This record already exists. Please check for duplicates.'
    );
  });

  it('maps unique constraint errors', () => {
    expect(getSafeErrorMessage({ message: 'unique constraint violation on users_email_key' })).toBe(
      'This record already exists. Please check for duplicates.'
    );
  });

  it('maps foreign key errors', () => {
    expect(getSafeErrorMessage(new Error('violates foreign key constraint "fk_booking_room"'))).toBe(
      'Cannot complete this action - the record is being used by other data.'
    );
  });

  it('maps "still referenced" errors', () => {
    expect(getSafeErrorMessage(new Error('key is still referenced from table bookings'))).toBe(
      'Cannot complete this action - the record is being used by other data.'
    );
  });

  it('maps RLS/permission denied errors', () => {
    expect(getSafeErrorMessage(new Error('new row violates row-level security policy'))).toBe(
      'You do not have permission to perform this action.'
    );
  });

  it('maps permission denied errors', () => {
    expect(getSafeErrorMessage('permission denied for table rooms')).toBe(
      'You do not have permission to perform this action.'
    );
  });

  it('maps check constraint errors', () => {
    expect(getSafeErrorMessage(new Error('violates check constraint "positive_price"'))).toBe(
      'The provided data does not meet the required format or limits.'
    );
  });

  it('maps not found errors', () => {
    expect(getSafeErrorMessage(new Error('Resource not found'))).toBe(
      'The requested resource was not found.'
    );
  });

  it('maps "does not exist" errors', () => {
    expect(getSafeErrorMessage(new Error('column "foo" does not exist'))).toBe(
      'The requested resource was not found.'
    );
  });

  it('maps invalid input errors', () => {
    expect(getSafeErrorMessage(new Error('invalid input syntax for type uuid'))).toBe(
      'Invalid data provided. Please check your input.'
    );
  });

  it('maps network errors', () => {
    expect(getSafeErrorMessage(new Error('network request failed'))).toBe(
      'Network error. Please check your connection and try again.'
    );
  });

  it('maps connection timeout errors', () => {
    expect(getSafeErrorMessage(new Error('Connection timeout after 30s'))).toBe(
      'Network error. Please check your connection and try again.'
    );
  });

  it('maps invalid login credentials (caught by generic "invalid" branch)', () => {
    expect(getSafeErrorMessage(new Error('Invalid login credentials'))).toBe(
      'Invalid data provided. Please check your input.'
    );
  });

  it('maps email not confirmed', () => {
    expect(getSafeErrorMessage(new Error('Email not confirmed'))).toBe(
      'Please verify your email before signing in.'
    );
  });

  it('maps user already registered', () => {
    expect(getSafeErrorMessage(new Error('User already registered'))).toBe(
      'An account with this email already exists.'
    );
  });

  it('returns generic message for unknown errors', () => {
    expect(getSafeErrorMessage(new Error('some internal pg error'))).toBe(
      'An error occurred. Please try again or contact support if this persists.'
    );
  });

  it('handles null/undefined input', () => {
    expect(getSafeErrorMessage(null)).toBe(
      'An error occurred. Please try again or contact support if this persists.'
    );
    expect(getSafeErrorMessage(undefined)).toBe(
      'An error occurred. Please try again or contact support if this persists.'
    );
  });

  it('handles number input', () => {
    expect(getSafeErrorMessage(42)).toBe(
      'An error occurred. Please try again or contact support if this persists.'
    );
  });
});

describe('logError', () => {
  it('logs context and error to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('test');
    logError('BookingCreate', error);
    expect(spy).toHaveBeenCalledWith('[BookingCreate]', error);
    spy.mockRestore();
  });
});
