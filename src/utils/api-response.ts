import { NextResponse } from 'next/server'

interface ErrorResponseOptions {
  status: number
  code?: string
  details?: unknown
}

export function apiError(error: string, options: ErrorResponseOptions) {
  return NextResponse.json(
    {
      success: false,
      error,
      message: error,
      ...(options.code ? { code: options.code } : {}),
      ...(options.details ? { details: options.details } : {}),
    },
    { status: options.status }
  )
}

export function logApiError(
  route: string,
  operation: string,
  err: unknown,
  ids: Record<string, string | undefined | null> = {}
) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[${route}] ${operation} failed`, { message, ...ids })
}
