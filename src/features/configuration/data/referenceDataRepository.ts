import {
  BackendReferenceData,
  BackendAppConfig,
  BackendVerificationRequirements,
  IReferenceDataRepository,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { ServerFailureError } from '../../../core/errors/DomainError';

/**
 * Real Backend Reference Data Repository.
 * Directly integrates confirmed SevaNest backend endpoints:
 * - GET /api/v1/reference-data
 * - GET /api/v1/app-config
 * - GET /api/v1/admin/verification/requirements
 */
export class RealReferenceDataRepository implements IReferenceDataRepository {
  async getReferenceData(): Promise<BackendReferenceData> {
    try {
      const response = await httpClient.get<BackendReferenceData>('/reference-data');
      const data = response.data;

      if (!data || typeof data !== 'object') {
        throw new ServerFailureError('Invalid response shape from reference-data endpoint.');
      }

      if (
        !Array.isArray(data.engagements) ||
        !Array.isArray(data.budgetPeriods) ||
        !Array.isArray(data.reportReasons) ||
        !Array.isArray(data.ticketPriorities) ||
        !Array.isArray(data.languages)
      ) {
        throw new ServerFailureError('Reference data missing mandatory collection attributes.');
      }

      return {
        engagements: data.engagements.map(String),
        budgetPeriods: data.budgetPeriods.map(String),
        reportReasons: data.reportReasons.map(String),
        ticketPriorities: data.ticketPriorities.map(String),
        languages: data.languages.map(String),
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getAppConfig(): Promise<BackendAppConfig> {
    try {
      const response = await httpClient.get<BackendAppConfig>('/app-config');
      const data = response.data;

      if (!data || typeof data !== 'object') {
        throw new ServerFailureError('Invalid response shape from app-config endpoint.');
      }

      return {
        customer: {
          minVersion: data.customer?.minVersion ? String(data.customer.minVersion) : null,
        },
        worker: {
          minVersion: data.worker?.minVersion ? String(data.worker.minVersion) : null,
        },
        maintenance: Boolean(data.maintenance),
        support: {
          phone: data.support?.phone ? String(data.support.phone) : null,
          email: data.support?.email ? String(data.support.email) : null,
        },
        legal: {
          acceptanceRequired: Boolean(data.legal?.acceptanceRequired),
          terms: data.legal?.terms ? String(data.legal.terms) : null,
          privacy: data.legal?.privacy ? String(data.legal.privacy) : null,
        },
        languages: Array.isArray(data.languages) ? data.languages.map(String) : ['en'],
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getVerificationRequirements(): Promise<BackendVerificationRequirements> {
    try {
      const response = await httpClient.get<BackendVerificationRequirements>(
        '/admin/verification/requirements'
      );
      const data = response.data;

      if (!data || typeof data !== 'object' || !Array.isArray(data.checkTypes)) {
        throw new ServerFailureError(
          'Invalid response shape from verification requirements endpoint.'
        );
      }

      return {
        checkTypes: data.checkTypes.map(String),
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

/**
 * Mock Reference Data Repository for offline testing and test isolation.
 */
export class MockReferenceDataRepository implements IReferenceDataRepository {
  async getReferenceData(): Promise<BackendReferenceData> {
    return {
      engagements: ['FULL_TIME', 'PART_TIME', 'LIVE_IN', 'DAILY', 'HOURLY', 'SHIFT', 'ONE_TIME'],
      budgetPeriods: ['HOUR', 'DAY', 'MONTH', 'ONE_TIME'],
      reportReasons: ['HARASSMENT', 'THEFT', 'SAFETY_CONCERN', 'MISCONDUCT', 'FRAUD', 'NO_SHOW', 'OTHER'],
      ticketPriorities: ['LOW', 'MEDIUM', 'HIGH'],
      languages: ['en'],
    };
  }

  async getAppConfig(): Promise<BackendAppConfig> {
    return {
      customer: { minVersion: null },
      worker: { minVersion: null },
      maintenance: false,
      support: { phone: null, email: null },
      legal: { acceptanceRequired: false, terms: null, privacy: null },
      languages: ['en'],
    };
  }

  async getVerificationRequirements(): Promise<BackendVerificationRequirements> {
    return {
      checkTypes: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
    };
  }
}

export function createReferenceDataRepository(): IReferenceDataRepository {
  if (env.VITE_USE_MOCK_AUTH) {
    return new MockReferenceDataRepository();
  }
  return new RealReferenceDataRepository();
}

export const referenceDataRepository = createReferenceDataRepository();
