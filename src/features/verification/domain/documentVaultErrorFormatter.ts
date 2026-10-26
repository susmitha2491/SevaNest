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
  const errObj = (typeof error === 'object' && error !== null ? error : {}) as ErrorWithStatus;
  const msg = errObj.message || (error instanceof Error ? error.message : '');
  const lower = msg.toLowerCase();
  const status = errObj.status ?? errObj.response?.status;
  const name = errObj.name;

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
