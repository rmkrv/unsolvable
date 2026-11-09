import { NextResponse } from "next/server";
import {
  AuthenticationRequired,
  Conflict,
  ResourceForbidden,
  ResourceNotFound,
  RoleForbidden,
} from "@/lib/server/auth/authorization-errors";

export type ApiErrorBody = { error: { code: string; message: string } };

export function apiErrorResponse(error: unknown): NextResponse<ApiErrorBody> | null {
  if (error instanceof AuthenticationRequired) return errorResponse(error.code, error.message, 401);
  if (error instanceof RoleForbidden || error instanceof ResourceForbidden) {
    return errorResponse(error.code, error.message, 403);
  }
  if (error instanceof ResourceNotFound) return errorResponse(error.code, error.message, 404);
  if (error instanceof Conflict) return errorResponse(error.code, error.message, 409);
  return null;
}

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
