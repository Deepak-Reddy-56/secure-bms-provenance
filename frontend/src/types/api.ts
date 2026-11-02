// API response types

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  txId?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isConflict: boolean;
  public readonly isNotFound: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isConflict = statusCode === 409;
    this.isNotFound = statusCode === 404;
  }
}
