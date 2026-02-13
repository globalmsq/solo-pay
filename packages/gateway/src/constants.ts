/**
 * Base path for API v1. Single source of truth for gateway and consumers (tests, SDK, docs).
 * Keep in code (not env): the path is part of the API contract and is the same in every environment.
 * When introducing v2: add API_V2_BASE_PATH and register both; do not replace this constant.
 */
export const API_V1_BASE_PATH = '/api/v1';
