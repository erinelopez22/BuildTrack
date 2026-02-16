export class PaginationQuery {
  page?: number = 1;
  limit?: number = 10;
  sortBy?: string = 'created_at';
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}

export class ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  error?: any;

  constructor(success: boolean, data: T | null, message: string, error?: any) {
    this.success = success;
    this.data = data;
    this.message = message;
    if (error) this.error = error;
  }
}

export class ErrorResponse {
  success: boolean = false;
  message: string;
  errors?: Record<string, string>;
  statusCode: number;

  constructor(message: string, statusCode: number = 500, errors?: Record<string, string>) {
    this.message = message;
    this.statusCode = statusCode;
    if (errors) this.errors = errors;
  }
}
