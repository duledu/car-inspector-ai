import { NextRequest, NextResponse } from 'next/server'

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

export async function parseJsonBody(req: NextRequest): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, data: await req.json() }
  } catch {
    return { ok: false, response: apiError('Invalid JSON body', { status: 400, code: 'INVALID_JSON' }) }
  }
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
