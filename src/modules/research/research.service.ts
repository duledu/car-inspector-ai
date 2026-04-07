// =============================================================================
// Vehicle Research Service
// Orchestrates: AI provider (OpenAI) → brand knowledge base → generic fallback
// =============================================================================

import type { VehicleResearchResult } from '@/types'
import { generateFallbackResult } from './fallback.knowledge'

export interface ResearchParams {
  make: string
  model: string
  year: number
  engine?: string
  trim?: string
}

export interface ResearchOutput extends VehicleResearchResult {
  limitedMode: boolean
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(params: ResearchParams): string {
  const { make, model, year, engine, trim } = params
  const vehicleDesc = [year, make, model, trim, engine].filter(Boolean).join(' ')

  return `You are an expert automotive advisor helping a buyer inspect a used car.

The buyer is about to inspect a **${vehicleDesc}**.

Generate a practical pre-inspection guide based on real known issues, owner reports, and expert knowledge for this exact vehicle.

Rules:
- Be specific to this make/model/year generation
- Use "commonly reported", "owners often note" language — not absolute facts
- Focus on what a buyer physically checking this car should look for
- Include repair cost context where it is a genuine financial risk
- Be concise and actionable

Respond ONLY with valid JSON. No markdown, no code fences, no prose before or after.

{
  "vehicleKey": "${vehicleDesc}",
  "generatedAt": "${new Date().toISOString()}",
  "confidence": "high",
  "overallRiskLevel": "moderate",
  "summary": "1-2 sentence overview of reliability and what buyers should know",
  "sections": {
    "commonProblems": { "id": "commonProblems", "title": "Common Problems", "items": [{ "title": "...", "description": "...", "severity": "high", "tags": ["COMMON_ISSUE"] }] },
    "highPriorityChecks": { "id": "highPriorityChecks", "title": "High-Priority Checks", "items": [{ "title": "...", "description": "...", "severity": "high", "tags": ["HIGH_ATTENTION"] }] },
    "visualAttention": { "id": "visualAttention", "title": "Visual Attention Areas", "items": [{ "title": "...", "description": "...", "severity": "medium", "tags": ["VISUAL_CHECK"] }] },
    "mechanicalWatchouts": { "id": "mechanicalWatchouts", "title": "Mechanical Watchouts", "items": [{ "title": "...", "description": "...", "severity": "high", "tags": ["COMMON_ISSUE"] }] },
    "testDriveFocus": { "id": "testDriveFocus", "title": "Test Drive Focus", "items": [{ "title": "...", "description": "...", "severity": "high", "tags": ["TEST_DRIVE"] }] },
    "costAwareness": { "id": "costAwareness", "title": "Cost Awareness", "items": [{ "title": "...", "description": "...", "severity": "high", "tags": ["EXPENSIVE_RISK"] }] }
  },
  "disclaimer": "AI-generated guide. Verify with a qualified mechanic before purchase."
}

Generate 3-5 items per section. Be specific to the ${vehicleDesc}.`
}

// ─── OpenAI caller with timeout ───────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  params: ResearchParams,
  timeoutMs: number
): Promise<VehicleResearchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 3000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an expert automotive advisor. Respond with valid JSON only — the structure specified by the user.',
          },
          { role: 'user', content: buildPrompt(params) },
        ],
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`OpenAI ${response.status}: ${text.slice(0, 200)}`)
    }

    const json = await response.json()
    const content: string = json.choices?.[0]?.message?.content ?? ''

    // Strip any accidental code fences
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(cleaned) as VehicleResearchResult
  } finally {
    clearTimeout(timer)
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class VehicleResearchService {
  constructor(private readonly openaiApiKey: string) {}

  async research(params: ResearchParams): Promise<ResearchOutput> {
    if (!this.openaiApiKey) {
      console.log('[research] No API key — using knowledge base')
      return { ...generateFallbackResult(params), limitedMode: true }
    }

    // Attempt 1
    try {
      const result = await callOpenAI(this.openaiApiKey, params, 8000)
      console.log('[research] AI response OK (attempt 1)')
      return { ...result, limitedMode: false }
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
      console.warn(`[research] Attempt 1 failed (${isTimeout ? 'timeout' : 'error'}) — retrying`)
    }

    // Attempt 2 (only if not a timeout — timeouts won't improve)
    try {
      const result = await callOpenAI(this.openaiApiKey, params, 8000)
      console.log('[research] AI response OK (attempt 2)')
      return { ...result, limitedMode: false }
    } catch (err) {
      console.warn('[research] Attempt 2 failed — using knowledge base fallback:', err instanceof Error ? err.message : err)
    }

    // Fallback — knowledge base
    console.log('[research] Using knowledge base fallback')
    return { ...generateFallbackResult(params), limitedMode: true }
  }
}

// Singleton — API key is read once at module load (server-side only)
export const vehicleResearchService = new VehicleResearchService(
  process.env.OPENAI_API_KEY ?? ''
)
