// =============================================================================
// GET /api/ai-analysis/test — Quick OpenAI key diagnostic (dev/debug only)
// =============================================================================
import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ ok: false, stage: 'env', error: 'OPENAI_API_KEY is not set in this environment' })
  }

  const prefix = apiKey.slice(0, 10)
  const len    = apiKey.length

  // Make a minimal text-only request (no image, cheapest possible call)
  let openAIStatus = 0
  let openAIBody   = ''
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Reply: ok' }],
      }),
    })
    clearTimeout(timer)
    openAIStatus = res.status
    openAIBody   = await res.text()

    if (res.ok) {
      return NextResponse.json({ ok: true, stage: 'openai_ok', keyPrefix: prefix, keyLen: len, status: openAIStatus })
    }

    let parsed: any = {}
    try { parsed = JSON.parse(openAIBody) } catch { /* raw text */ }
    return NextResponse.json({
      ok: false, stage: 'openai_error',
      keyPrefix: prefix, keyLen: len,
      status:      openAIStatus,
      code:        parsed?.error?.code    ?? '(none)',
      type:        parsed?.error?.type    ?? '(none)',
      message:     (parsed?.error?.message ?? openAIBody).slice(0, 300),
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false, stage: 'fetch_failed',
      keyPrefix: prefix, keyLen: len,
      status:    openAIStatus,
      error:     err instanceof Error ? err.message : String(err),
    })
  }
}
