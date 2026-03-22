/**
 * Tests for admin authorization utility.
 */
import { describe, it, expect } from 'vitest';
import { isAdmin, ADMIN_EMAILS } from '@/lib/admin';

describe('isAdmin', () => {
  it('returns true for known admin emails', () => {
    for (const email of ADMIN_EMAILS) {
      expect(isAdmin(email)).toBe(true);
    }
  });

  it('returns false for non-admin emails', () => {
    expect(isAdmin('regular@example.com')).toBe(false);
    expect(isAdmin('hacker@evil.com')).toBe(false);
  });

  it('returns false for null/undefined email', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it('is case-sensitive (email must match exactly)', () => {
    expect(isAdmin('MARCUSWOO@GMAIL.COM')).toBe(false);
    expect(isAdmin('Marcuswoo@gmail.com')).toBe(false);
  });
});
