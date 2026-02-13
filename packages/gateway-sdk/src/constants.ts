import type { Environment } from './types';

/** Base path for API v1 (must match gateway API_V1_BASE_PATH). */
export const API_V1_BASE_PATH = '/api/v1';

export const API_URLS: Record<Environment, string> = {
  development: `http://localhost:3001${API_V1_BASE_PATH}`,
  staging: `https://pay-api.staging.msq.com${API_V1_BASE_PATH}`,
  production: `https://pay-api.msq.com${API_V1_BASE_PATH}`,
  custom: '',
};

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};
