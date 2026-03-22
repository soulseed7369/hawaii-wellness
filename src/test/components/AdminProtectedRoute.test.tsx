/**
 * Tests for admin route guard.
 * Security-critical: ensures non-admins can't access /admin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Mock auth context ────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Mock admin check ─────────────────────────────────────────────────────────

vi.mock('@/lib/admin', () => ({
  isAdmin: (email: string | null | undefined) => email === 'marcuswoo@gmail.com',
  ADMIN_EMAILS: ['marcuswoo@gmail.com'],
}));

import { AdminProtectedRoute } from '@/components/AdminProtectedRoute';

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<div data-testid="admin-page">Admin Panel</div>} />
        </Route>
        <Route path="/auth" element={<div data-testid="auth-page">Login</div>} />
        <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    renderWithRouter('/admin');

    // Should show spinner, not admin or redirect
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /auth', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    renderWithRouter('/admin');

    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
  });

  it('redirects non-admin users to /dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'regular@example.com' },
      loading: false,
    });

    renderWithRouter('/admin');

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
  });

  it('renders admin panel for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'marcuswoo@gmail.com' },
      loading: false,
    });

    renderWithRouter('/admin');

    expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });
});
