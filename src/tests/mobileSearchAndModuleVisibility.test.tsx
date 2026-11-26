import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaskedPhoneText } from '../shared/components/MaskedPhoneText';
import { useAuthStore } from '../core/auth/authStore';
import { RealCustomerRepository } from '../features/customers/data/customerRepository';
import { RealWorkerRepository } from '../features/workers/data/workerRepository';
import { httpClient } from '../core/api/httpClient';
import {
  extractSearchMobileDigits,
  extractCanonicalMobileDigits,
  matchesPhoneDigits,
  setWorkerPhone,
  setCustomerPhone,
} from '../core/utils/phoneDirectory';
import type { AxiosRequestConfig } from 'axios';

describe('SevaNest Admin Portal - Mobile Number Visibility & Mobile Search Requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();

    useAuthStore.setState({
      user: {
        id: 'admin-super',
        name: 'Super Admin',
        email: 'superadmin@sevanest.internal',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        permissions: ['*'],
      },
      isAuthenticated: true,
      accessToken: 'auth-token-super',
    });
  });

  describe('1. Phone Number Normalization for Full & Partial Search Queries', () => {
    it('normalizes full mobile numbers with country code, spaces, hyphens, and leading zero', () => {
      expect(extractSearchMobileDigits('8341835477')).toBe('8341835477');
      expect(extractSearchMobileDigits('+918341835477')).toBe('8341835477');
      expect(extractSearchMobileDigits('+91 83418 35477')).toBe('8341835477');
      expect(extractSearchMobileDigits('+91-83418-35477')).toBe('8341835477');
      expect(extractSearchMobileDigits('83418-35477')).toBe('8341835477');
      expect(extractSearchMobileDigits('08341835477')).toBe('8341835477');

      // Canonical 10 digits
      expect(extractCanonicalMobileDigits('8341835477')).toBe('8341835477');
      expect(extractCanonicalMobileDigits('+91 83418 35477')).toBe('8341835477');
      expect(extractCanonicalMobileDigits('+91-83418-35477')).toBe('8341835477');
    });

    it('extracts partial mobile digits without rejecting numbers with fewer than 10 digits', () => {
      expect(extractSearchMobileDigits('8341')).toBe('8341');
      expect(extractSearchMobileDigits('35477')).toBe('35477');
      expect(extractSearchMobileDigits('83418')).toBe('83418');
      expect(extractSearchMobileDigits('+91 8341')).toBe('8341');
      expect(extractSearchMobileDigits('83-41')).toBe('8341');

      // Canonical 10 digits helper safely returns null for partial inputs to prevent HTTP 400
      expect(extractCanonicalMobileDigits('8341')).toBeNull();
      expect(extractCanonicalMobileDigits('35477')).toBeNull();
      expect(extractCanonicalMobileDigits('83418')).toBeNull();
    });

    it('rejects text and names so non-phone queries are handled as name/ID lookups', () => {
      expect(extractSearchMobileDigits('Nissy')).toBeNull();
      expect(extractSearchMobileDigits('Sunita Devi')).toBeNull();
      expect(extractSearchMobileDigits('CUST-1001')).toBeNull();
      expect(extractSearchMobileDigits('W-10482')).toBeNull();
      expect(extractSearchMobileDigits('')).toBeNull();
      expect(extractSearchMobileDigits(null)).toBeNull();
    });

    it('matchesPhoneDigits accurately matches partial and full digits against formatted and masked phones', () => {
      const nissyFullPhone = '+91 83418 35477';
      const nissyRawPhone = '+918341835477';
      const nissyMaskedPhone = '+91******5477';

      // 1. Searching 8341 matches +91 83418 35477
      expect(matchesPhoneDigits(nissyFullPhone, '8341')).toBe(true);
      expect(matchesPhoneDigits(nissyRawPhone, '8341')).toBe(true);

      // 2. Searching 35477 matches the same number
      expect(matchesPhoneDigits(nissyFullPhone, '35477')).toBe(true);
      expect(matchesPhoneDigits(nissyRawPhone, '35477')).toBe(true);

      // 3. Searching 83418 matches
      expect(matchesPhoneDigits(nissyFullPhone, '83418')).toBe(true);

      // 4. Searching full 10 digits matches
      expect(matchesPhoneDigits(nissyFullPhone, '8341835477')).toBe(true);
      expect(matchesPhoneDigits(nissyFullPhone, '+91 83418 35477')).toBe(true);

      // Masked phone matches visible tail digits
      expect(matchesPhoneDigits(nissyMaskedPhone, '5477')).toBe(true);
      // Non-matching numbers
      expect(matchesPhoneDigits(nissyFullPhone, '9999')).toBe(false);
    });
  });

  describe('2. Worker Management Search Contracts (Full, Partial, Name, and ID)', () => {
    it('partial search: searching "8341" finds worker Nissy with mobile "+91 83418 35477" across dataset', async () => {
      const workerRepo = new RealWorkerRepository();
      setWorkerPhone('wrk-nissy', '+91 83418 35477');

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/workers') {
          return {
            data: {
              items: [
                {
                  id: 'wrk-other',
                  name: 'Other Worker',
                  mobile: '+91******1111',
                  category: 'House Maid',
                  status: 'ACTIVE',
                },
                {
                  id: 'wrk-nissy',
                  name: 'Nissy',
                  mobile: '+91******5477',
                  category: 'Driver',
                  status: 'ACTIVE',
                },
              ],
              meta: { total: 2, page: 1, limit: 100 },
            },
          };
        }
        if (url === '/admin/workers/wrk-nissy') {
          return {
            data: {
              id: 'wrk-nissy',
              name: 'Nissy',
              mobile: '+918341835477',
              category: 'Driver',
              status: 'ACTIVE',
            },
          };
        }
        return { data: {} };
      });

      const result = await workerRepo.getWorkersPage({ searchTerm: '8341' }, 1, 20);

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('wrk-nissy');
      expect(result.items[0].name).toBe('Nissy');
    });

    it('partial search: searching "35477" finds the same worker Nissy', async () => {
      const workerRepo = new RealWorkerRepository();
      setWorkerPhone('wrk-nissy', '+91 83418 35477');

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/workers') {
          return {
            data: {
              items: [
                {
                  id: 'wrk-nissy',
                  name: 'Nissy',
                  mobile: '+91******5477',
                  category: 'Driver',
                  status: 'ACTIVE',
                },
              ],
              meta: { total: 1, page: 1, limit: 100 },
            },
          };
        }
        return { data: {} };
      });

      const result = await workerRepo.getWorkersPage({ searchTerm: '35477' }, 1, 20);

      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Nissy');
    });

    it('full 10-digit search: searching "8341835477" passes mobile=8341835477 directly to backend', async () => {
      const workerRepo = new RealWorkerRepository();
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          capturedParams = (config?.params as Record<string, unknown>) || {};
          return {
            data: {
              items: [
                {
                  id: 'wrk-nissy',
                  name: 'Nissy',
                  mobile: '+91 83418 35477',
                  category: 'Driver',
                  status: 'ACTIVE',
                },
              ],
              meta: { total: 1, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      const result = await workerRepo.getWorkersPage({ searchTerm: '8341835477' }, 1, 20);

      expect(capturedParams.mobile).toBe('8341835477');
      expect(capturedParams.name).toBeUndefined();
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Nissy');
    });

    it('full search with country code: searching "+91 83418 35477" passes mobile=8341835477 to backend', async () => {
      const workerRepo = new RealWorkerRepository();
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          capturedParams = (config?.params as Record<string, unknown>) || {};
          return {
            data: {
              items: [
                {
                  id: 'wrk-nissy',
                  name: 'Nissy',
                  mobile: '+91 83418 35477',
                  category: 'Driver',
                  status: 'ACTIVE',
                },
              ],
              meta: { total: 1, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      const result = await workerRepo.getWorkersPage({ searchTerm: '+91 83418 35477' }, 1, 20);

      expect(capturedParams.mobile).toBe('8341835477');
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Nissy');
    });

    it('name search: searching "Nissy" passes name=Nissy to backend', async () => {
      const workerRepo = new RealWorkerRepository();
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/workers') {
          capturedParams = (config?.params as Record<string, unknown>) || {};
          return {
            data: {
              items: [{ id: 'wrk-nissy', name: 'Nissy', category: 'Driver', status: 'ACTIVE' }],
              meta: { total: 1, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      const result = await workerRepo.getWorkersPage({ searchTerm: 'Nissy' }, 1, 20);

      expect(capturedParams.name).toBe('Nissy');
      expect(capturedParams.mobile).toBeUndefined();
      expect(result.items.length).toBe(1);
    });

    it('ID search: searching "W-10482" queries documented GET /admin/workers/{workerId}', async () => {
      const workerRepo = new RealWorkerRepository();
      let queriedId = '';

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url.includes('/admin/workers/W-10482')) {
          queriedId = 'W-10482';
          return {
            data: {
              id: 'W-10482',
              workerId: 'W-10482',
              name: 'Sunita Devi',
              category: 'House Maid',
              status: 'ACTIVE',
              isFullyVerified: true,
            },
          };
        }
        return { data: {} };
      });

      const result = await workerRepo.getWorkersPage({ searchTerm: 'W-10482' }, 1, 20);

      expect(queriedId).toBe('W-10482');
      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('W-10482');
    });
  });

  describe('3. Customer Management Search Contracts (Full, Partial, Name, and ID)', () => {
    it('partial search: searching "8341" finds customer whose phone contains 8341 across dataset', async () => {
      const customerRepo = new RealCustomerRepository();
      setCustomerPhone('cust-8341', '+91 83418 99999');

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/customers') {
          return {
            data: {
              items: [
                {
                  id: 'cust-101',
                  name: 'Other Customer',
                  mobile: '+91******1111',
                  status: 'ACTIVE',
                },
                {
                  id: 'cust-8341',
                  name: 'Ravi Teja',
                  mobile: '+91******9999',
                  status: 'ACTIVE',
                },
              ],
              meta: { total: 2, page: 1, limit: 100 },
            },
          };
        }
        if (url === '/admin/customers/cust-8341') {
          return {
            data: {
              id: 'cust-8341',
              name: 'Ravi Teja',
              mobile: '+918341899999',
              status: 'ACTIVE',
            },
          };
        }
        return { data: {} };
      });

      const result = await customerRepo.getCustomersPage({ searchTerm: '8341' }, 1, 20);

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('cust-8341');
      expect(result.items[0].name).toBe('Ravi Teja');
    });

    it('full 10-digit search: searching "9876543210" passes mobile=9876543210 to backend', async () => {
      const customerRepo = new RealCustomerRepository();
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/customers') {
          capturedParams = (config?.params as Record<string, unknown>) || {};
          return {
            data: {
              items: [{ id: 'cust-1', name: 'Rohan Sharma', mobile: '+91 98765 43210' }],
              meta: { total: 1, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      const result = await customerRepo.getCustomersPage({ searchTerm: '9876543210' }, 1, 20);

      expect(capturedParams.mobile).toBe('9876543210');
      expect(result.items.length).toBe(1);
    });

    it('name search: searching "Priya" passes name=Priya to backend', async () => {
      const customerRepo = new RealCustomerRepository();
      let capturedParams: Record<string, unknown> = {};

      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: AxiosRequestConfig) => {
        if (url === '/admin/customers') {
          capturedParams = (config?.params as Record<string, unknown>) || {};
          return {
            data: {
              items: [{ id: 'cust-102', name: 'Priya Verma', mobile: '+91 91234 56789' }],
              meta: { total: 1, page: 1, limit: 20 },
            },
          };
        }
        return { data: {} };
      });

      await customerRepo.getCustomersPage({ searchTerm: 'Priya' }, 1, 20);

      expect(capturedParams.name).toBe('Priya');
      expect(capturedParams.mobile).toBeUndefined();
    });
  });

  describe('4. Mobile Reveal Feature Restriction to Customer and Worker Management', () => {
    it('Customer Management (allowReveal={true}): Eye icon is displayed and clicking reveals genuine number', () => {
      render(
        <MaskedPhoneText
          maskedPhone="+91******4321"
          unmaskedPhone="+91 98765 44321"
          allowReveal={true}
          entityType="customer"
          testId="cust-phone-row"
        />
      );

      expect(screen.getByText('+91******4321')).toBeInTheDocument();

      const eyeBtn = screen.getByRole('button', { name: /show phone number/i });
      expect(eyeBtn).toBeInTheDocument();

      fireEvent.click(eyeBtn);
      expect(screen.getByText('+91 98765 44321')).toBeInTheDocument();
      expect(screen.queryByText('+91******4321')).not.toBeInTheDocument();

      const hideBtn = screen.getByRole('button', { name: /hide phone number/i });
      fireEvent.click(hideBtn);
      expect(screen.getByText('+91******4321')).toBeInTheDocument();
      expect(screen.queryByText('+91 98765 44321')).not.toBeInTheDocument();
    });

    it('Worker Management (allowReveal={true}): Eye icon is displayed and clicking reveals genuine number', () => {
      setWorkerPhone('w-101', '+91 98888 77777');

      render(
        <MaskedPhoneText
          maskedPhone="+91******7777"
          entityId="w-101"
          entityType="worker"
          allowReveal={true}
          testId="worker-phone-row"
        />
      );

      expect(screen.getByText('+91******7777')).toBeInTheDocument();

      const eyeBtn = screen.getByRole('button', { name: /show phone number/i });
      expect(eyeBtn).toBeInTheDocument();

      fireEvent.click(eyeBtn);
      expect(screen.getByText('+91 98888 77777')).toBeInTheDocument();
    });

    it('Booking Management (allowReveal={false}): Strictly masked with ZERO reveal controls', () => {
      render(
        <div data-testid="booking-modal-contacts">
          <MaskedPhoneText
            maskedPhone="+91******6655"
            unmaskedPhone="+91 98765 46655"
            allowReveal={false}
            testId="booking-cust-phone"
          />
          <MaskedPhoneText
            maskedPhone="+91******8919"
            unmaskedPhone="+91 98765 48919"
            allowReveal={false}
            testId="booking-worker-phone"
          />
        </div>
      );

      expect(screen.getByText('+91******6655')).toBeInTheDocument();
      expect(screen.getByText('+91******8919')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('Verification, Support, Payments, Directory, Attendance: Strictly masked with ZERO reveal controls by default', () => {
      render(
        <div>
          <MaskedPhoneText maskedPhone="+91******1234" unmaskedPhone="+91 98765 41234" />
          <MaskedPhoneText maskedPhone="+91******5678" unmaskedPhone="+91 98765 45678" />
          <MaskedPhoneText maskedPhone="+91******9012" unmaskedPhone="+91 98765 49012" />
          <MaskedPhoneText maskedPhone="+91******3456" unmaskedPhone="+91 98765 43456" />
          <MaskedPhoneText maskedPhone="+91******7890" unmaskedPhone="+91 98765 47890" />
        </div>
      );

      expect(screen.getByText('+91******1234')).toBeInTheDocument();
      expect(screen.getByText('+91******5678')).toBeInTheDocument();
      expect(screen.getByText('+91******9012')).toBeInTheDocument();
      expect(screen.getByText('+91******3456')).toBeInTheDocument();
      expect(screen.getByText('+91******7890')).toBeInTheDocument();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('5. In-Memory Privacy & Storage Protection', () => {
    it('never writes revealed numbers to localStorage or sessionStorage', () => {
      render(
        <MaskedPhoneText
          maskedPhone="+91******9999"
          unmaskedPhone="+91 99999 88888"
          allowReveal={true}
        />
      );

      const eyeBtn = screen.getByRole('button', { name: /show phone number/i });
      fireEvent.click(eyeBtn);

      expect(screen.getByText('+91 99999 88888')).toBeInTheDocument();
      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
    });
  });
});
