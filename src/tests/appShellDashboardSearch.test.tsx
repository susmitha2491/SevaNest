import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '../app/layouts/AppShell';
import { useAuthStore } from '../core/auth/authStore';

describe('AppShell: Header Search Box Visibility', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useAuthStore.getState().setSession(
      {
        id: 'adm-001',
        name: 'Verification Executive',
        email: 'verification.executive@sevanest.example.com',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: ['alert.view', 'verification.review', 'worker.view'],
      },
      'fake-token',
      'fake-refresh'
    );
  });

  const renderWithRouter = (initialPath: string) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route path="dashboard" element={<div>Dashboard Content</div>} />
              <Route path="reports" element={<div>Reports Content</div>} />
              <Route path="workers" element={<div>Workers Content</div>} />
              <Route path="verification" element={<div>Verification Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('does NOT render the header search box on /dashboard', () => {
    renderWithRouter('/dashboard');
    expect(
      screen.queryByPlaceholderText('Search by ID, Name, Phone, or Booking Ref...')
    ).not.toBeInTheDocument();
  });

  it('does NOT render the header search box on /customers', () => {
    renderWithRouter('/customers');
    expect(
      screen.queryByPlaceholderText('Search by ID, Name, Phone, or Booking Ref...')
    ).not.toBeInTheDocument();
  });

  it('does NOT render the header search box on /workers', () => {
    renderWithRouter('/workers');
    expect(
      screen.queryByPlaceholderText('Search by ID, Name, Phone, or Booking Ref...')
    ).not.toBeInTheDocument();
  });

  it('does NOT render the header search box on /verification', () => {
    renderWithRouter('/verification');
    expect(
      screen.queryByPlaceholderText('Search by ID, Name, Phone, or Booking Ref...')
    ).not.toBeInTheDocument();
  });
});
