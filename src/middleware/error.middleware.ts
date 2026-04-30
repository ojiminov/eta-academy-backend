import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

interface ErrorDetail {
  field?: string;
  message: string;
}

interface ApiError {
  code: string;
  message: string;
  details: ErrorDetail[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  const errorBody: ApiError = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
    details: [],
  };

  // ── Zod validation errors ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    statusCode = 400;
    errorBody.code = 'VALIDATION_ERROR';
    errorBody.message = 'Request validation failed.';
    errorBody.details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // ── Prisma known errors ────────────────────────────────────────────────────
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        statusCode = 409;
        const fields = (err.meta?.target as string[] | undefined) ?? [];
        errorBody.code = 'CONFLICT';
        errorBody.message = `A record with this ${fields.join(', ')} already exists.`;
        errorBody.details = [{ field: fields.join(', '), message: errorBody.message }];
        break;
      }
      case 'P2025':
        statusCode = 404;
        errorBody.code = 'NOT_FOUND';
        errorBody.message = 'The requested record was not found.';
        break;
      case 'P2003':
        statusCode = 400;
        errorBody.code = 'FOREIGN_KEY_CONSTRAINT';
        errorBody.message = 'A related record was not found.';
        break;
      default:
        statusCode = 400;
        errorBody.code = 'DATABASE_ERROR';
        errorBody.message = 'A database error occurred.';
        break;
    }
  }

  // ── Prisma validation errors ───────────────────────────────────────────────
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    errorBody.code = 'DATABASE_VALIDATION_ERROR';
    errorBody.message = 'Invalid data provided to the database.';
  }

  // ── JWT errors ─────────────────────────────────────────────────────────────
  else if (err instanceof TokenExpiredError) {
    statusCode = 401;
    errorBody.code = 'TOKEN_EXPIRED';
    errorBody.message = 'Your session has expired. Please log in again.';
  } else if (err instanceof JsonWebTokenError) {
    statusCode = 401;
    errorBody.code = 'INVALID_TOKEN';
    errorBody.message = 'Invalid token provided.';
  }

  // ── Generic Error with custom status ──────────────────────────────────────
  else if (err instanceof Error) {
    const appErr = err as Error & { statusCode?: number; code?: string };
    if (appErr.statusCode) {
      statusCode = appErr.statusCode;
      errorBody.code = appErr.code ?? 'APP_ERROR';
      errorBody.message = appErr.message;
    } else {
      // Log unexpected errors
      console.error('[Unhandled Error]', err);
    }
  }

  res.status(statusCode).json({
    success: false,
    error: errorBody,
  });
}
