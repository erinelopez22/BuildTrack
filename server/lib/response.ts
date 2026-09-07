// Mirrors backend/BuildTrack.API/DTOs/Common/ApiResponse.cs
import type { Context } from 'hono';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export const ok = <T>(c: Context, data?: T, message?: string, status = 200) =>
  c.json<ApiResponse<T>>({ success: true, data, message }, status as never);

export const fail = (
  c: Context,
  message: string,
  status = 400,
  errors?: Record<string, string[]>,
) => c.json<ApiResponse<never>>({ success: false, message, errors }, status as never);

export const created = <T>(c: Context, data: T, message?: string) =>
  ok(c, data, message, 201);
