import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  NetworkError,
} from '../../../core/errors/DomainError';

export interface FormattedDocError {
  title: string;
  message: string;
  isPermissionError: boolean;
  canRetry: boolean;
}

interface ErrorWithStatus {
  status?: number;
  response?: { status?: number };
  name?: string;
  message?: string;
}

export function formatDocumentVaultError(error: unknown): FormattedDocError {
  const errObj = (typeof error === 'object' && error !== null ? error : {}) as ErrorWithStatus & {
    errorCode?: string;
    code?: string;
    details?: unknown;
  };
  const code = (errObj.errorCode || errObj.code || '').toUpperCase();
  const msg = errObj.message || (error instanceof Error ? error.message : '');
  const lower = msg.toLowerCase();
  const codeUpper = (code + ' ' + msg).toUpperCase();
  const status = errObj.status ?? errObj.response?.status;
  const name = errObj.name;

  // Specific document error codes from backend vault contract
  if (codeUpper.includes('DOCUMENT_NOT_AVAILABLE')) {
    return {
      title: 'Document Not Available',
      message: 'The requested document is not currently available for inspection.',
      isPermissionError: false,
      canRetry: true,
    };
  }

  if (codeUpper.includes('DOCUMENT_OBJECT_MISSING')) {
    return {
      title: 'Document Missing from Storage',
      message: 'The document file is missing from storage. Please request the worker to re-upload.',
      isPermissionError: false,
      canRetry: true,
    };
  }

  if (codeUpper.includes('DOCUMENT_INTEGRITY_FAILED')) {
    return {
      title: 'Document Integrity Check Failed',
      message: 'Document integrity check failed. The file may be corrupted.',
      isPermissionError: false,
      canRetry: false,
    };
  }

  if (codeUpper.includes('STORAGE_NOT_CONFIGURED')) {
    return {
      title: 'Storage Service Not Configured',
      message: 'Storage service is not configured. Please contact the system administrator.',
      isPermissionError: false,
      canRetry: false,
    };
  }

  const isAuthError =
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError ||
    name === 'UnauthorizedError' ||
    name === 'ForbiddenError' ||
    status === 401 ||
    status === 403;

  if (isAuthError && !lower.includes('expired')) {
    return {
      title: 'Failed to load document attachment',
      message: msg
        ? `Access Restricted (401 / 403): ${msg}`
        : 'Access Restricted (401 / 403): You do not have server authorization to view confidential verification documents. Ensure your account has the verification.document.view permission.',
      isPermissionError: true,
      canRetry: false,
    };
  }

  if (
    error instanceof NotFoundError ||
    name === 'NotFoundError' ||
    status === 404 ||
    lower.includes('not found') ||
    lower.includes('404')
  ) {
    return {
      title: 'Failed to load document attachment',
      message: msg
        ? `Document Vault Access Unavailable: ${msg}`
        : 'Document Vault Access Unavailable: Document not found',
      isPermissionError: false,
      canRetry: true,
    };
  }

  if (lower.includes('expired')) {
    return {
      title: 'Failed to load document attachment',
      message: msg
        ? `Document Vault Access Unavailable: ${msg}`
        : 'Signed Document URL Expired: The secure short-lived document link has expired. Click below to request a fresh authorized link from the backend vault.',
      isPermissionError: false,
      canRetry: true,
    };
  }

  if (error instanceof NetworkError || lower.includes('network')) {
    return {
      title: 'Failed to load document attachment',
      message: msg
        ? `Network or Storage Connection Failure: ${msg}`
        : 'Network or Storage Connection Failure: Unable to connect to the backend document storage vault. Please verify your connection or proxy configuration and retry.',
      isPermissionError: false,
      canRetry: true,
    };
  }

  return {
    title: 'Failed to load document attachment',
    message: msg
      ? `Document Vault Access Unavailable: ${msg}`
      : 'Document Vault Access Unavailable: The signed document link is missing, expired, or access was rejected. Required contract: GET /api/v1/admin/verification/documents/{documentId}/link.',
    isPermissionError: false,
    canRetry: true,
  };
}
