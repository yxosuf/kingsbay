import { describe, it, expect } from 'vitest';
import { countries, getCountryByName, getDialCodeByCountry } from '../countryData';

describe('countries', () => {
  it('contains Sri Lanka as the first entry', () => {
    expect(countries[0].name).toBe('Sri Lanka');
    expect(countries[0].code).toBe('LK');
    expect(countries[0].dialCode).toBe('+94');
  });

  it('has unique country codes', () => {
    const codes = countries.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every entry has name, code, and dialCode', () => {
    for (const c of countries) {
      expect(c.name).toBeTruthy();
      expect(c.code).toBeTruthy();
      expect(c.dialCode).toMatch(/^\+\d+$/);
    }
  });
});

describe('getCountryByName', () => {
  it('finds a country by exact name', () => {
    const result = getCountryByName('Sri Lanka');
    expect(result?.code).toBe('LK');
  });

  it('is case-insensitive', () => {
    expect(getCountryByName('sri lanka')?.code).toBe('LK');
    expect(getCountryByName('SRI LANKA')?.code).toBe('LK');
  });

  it('returns undefined for unknown countries', () => {
    expect(getCountryByName('Atlantis')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getCountryByName('')).toBeUndefined();
  });
});

describe('getDialCodeByCountry', () => {
  it('returns dial code for a known country', () => {
    expect(getDialCodeByCountry('United States')).toBe('+1');
    expect(getDialCodeByCountry('India')).toBe('+91');
  });

  it('defaults to +94 (Sri Lanka) for unknown country', () => {
    expect(getDialCodeByCountry('Unknown')).toBe('+94');
  });

  it('defaults to +94 for empty string', () => {
    expect(getDialCodeByCountry('')).toBe('+94');
  });
});
