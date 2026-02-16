import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../dto/common.dto';
import { logger } from '../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Error:', err);

  if (err.statusCode) {
    return res.status(err.statusCode).json(new ErrorResponse(
      err.message,
      err.statusCode,
      err.errors
    ));
  }

  if (err.name === 'ZodError') {
    const errors: Record<string, string> = {};
    err.errors.forEach((e: any) => {
      errors[e.path.join('.')] = e.message;
    });
    return res.status(400).json(new ErrorResponse('Validation error', 400, errors));
  }

  return res.status(500).json(new ErrorResponse(
    err.message || 'Internal server error',
    500
  ));
}
