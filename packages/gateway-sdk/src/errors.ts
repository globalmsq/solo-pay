export interface ErrorDetails {
  message?: string;
  path?: (string | number)[];
  [key: string]: string | number | boolean | (string | number)[] | undefined;
}

export class SoloPayError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: ErrorDetails[]
  ) {
    super(message);
    this.name = 'SoloPayError';
    Object.setPrototypeOf(this, SoloPayError.prototype);
  }
}

export const ERROR_CODES: Record<string, number> = {
  VALIDATION_ERROR: 400,
  INVALID_REQUEST: 400,
  INVALID_TRANSACTION_DATA: 400,
  INVALID_GAS_ESTIMATE: 400,
  INVALID_SIGNATURE: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};
