// =============================================================================
// Vehicle Research API Route — POST /api/vehicle/research
// Uses Claude AI to generate a known-issues guide for a specific vehicle.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/config/env'
import type { VehicleResearchResult } from '@/types'

const schema = z.object({
  make:   z.string().min(1).max(60),
  model:  z.string().min(1).max(80),
  year:   z.number().int().min(1980).max(new Date().getFullYear() + 1),
  engine: z.string().max(100).optional(),
  trim:   z.string().max(80).optional(),
})

// ─── Build the structured prompt ─────────────────────────────────────────────

function buildPrompt(make: string, model: string, year: number, engine?: string, trim?: string): string {
  const vehicleDesc = [year, make, model, trim, engine].filter(Boolean).join(' ')

  return `You are an expert automotive advisor helping a buyer inspect a used car before purchase.

The buyer is about to inspect a **${vehicleDesc}**.

Your task: Generate a comprehensive, practical pre-inspection guide based on real-world known issues, owner reports, recall data, and expert knowledge for this exact vehicle.

IMPORTANT RULES:
- Be specific to this exact make/model/year generation
- Use language like "commonly reported", "owners often note", "this generation may be prone to" — never present as absolute facts
- Prioritize issues that are actually common, not just theoretically possible
- Focus on what a buyer physically checking this car should look for
- Include repair cost context where it's genuinely a financial risk
- Be concise and actionable

Respond ONLY with valid JSON matching this exact structure:

{
  "vehicleKey": "${vehicleDesc}",
  "generatedAt": "${new Date().toISOString()}",
  "confidence": "high" | "medium" | "low",
  "overallRiskLevel": "low" | "moderate" | "high",
  "summary": "1–2 sentence overview of this model's general reliability and what buyers should know",
  "sections": {
    "commonProblems": {
      "id": "commonProblems",
      "title": "Common Problems",
      "items": [
        {
          "title": "Short problem title",
          "description": "Practical description of the issue and what to look for",
          "severity": "high" | "medium" | "low",
          "tags": ["COMMON_ISSUE"]
        }
      ]
    },
    "highPriorityChecks": {
      "id": "highPriorityChecks",
      "title": "High-Priority Checks",
      "items": [
        {
          "title": "Check item title",
          "description": "Specific thing to inspect and how",
          "severity": "high" | "medium" | "low",
          "tags": ["HIGH_ATTENTION"]
        }
      ]
    },
    "visualAttention": {
      "id": "visualAttention",
      "title": "Visual Attention Areas",
      "items": [
        {
          "title": "Area to inspect",
          "description": "What to look for visually",
          "severity": "high" | "medium" | "low",
          "tags": ["VISUAL_CHECK"]
        }
      ]
    },
    "mechanicalWatchouts": {
      "id": "mechanicalWatchouts",
      "title": "Mechanical Watchouts",
      "items": [
        {
          "title": "Mechanical issue",
          "description": "What it means and how to detect it",
          "severity": "high" | "medium" | "low",
          "tags": ["COMMON_ISSUE", "EXPENSIVE_RISK"]
        }
      ]
    },
    "testDriveFocus": {
      "id": "testDriveFocus",
      "title": "Test Drive Focus",
      "items": [
        {
          "title": "What to listen/feel for",
          "description": "Specific sensation or sound and what it may indicate",
          "severity": "high" | "medium" | "low",
          "tags": ["TEST_DRIVE"]
        }
      ]
    },
    "costAwareness": {
      "id": "costAwareness",
      "title": "Severity & Cost Awareness",
      "items": [
        {
          "title": "Expensive risk item",
          "description": "Why it's costly and what to negotiate on",
          "severity": "high" | "medium" | "low",
          "tags": ["EXPENSIVE_RISK"]
        }
      ]
    }
  },
  "disclaimer": "This guide is AI-generated based on commonly reported issues for this vehicle. Use as inspection guidance only — always verify findings with a qualified mechanic."
}

Generate 3–5 items per section. Be specific to the ${vehicleDesc}. Prioritize the most genuinely common and impactful issues real owners face.`
}

// ─── Call OpenAI API ─────────────────────────────────────────────────────────

async function callOpenAI(prompt: string): Promise<VehicleResearchResult> {
  const apiKey = env.openaiApiKey
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are an expert automotive advisor. Always respond with valid JSON only — no markdown, no prose, no code fences.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const result = await response.json()
  const text: string = result.choices?.[0]?.message?.content ?? ''

  // Strip any accidental code fences
  const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    return JSON.parse(jsonStr) as VehicleResearchResult
  } catch {
    throw new Error('Failed to parse AI response as JSON')
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    )
  }

  const { make, model, year, engine, trim } = parsed.data

  try {
    const prompt = buildPrompt(make, model, year, engine, trim)
    const research = await callOpenAI(prompt)
    return NextResponse.json({ data: research })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Research failed'
    console.error('[vehicle/research] Error:', err)
    const isConfigError = message.includes('not configured')
    return NextResponse.json(
      { message: isConfigError ? 'AI research is not available (API key not configured)' : message, code: 'RESEARCH_ERROR' },
      { status: isConfigError ? 503 : 500 }
    )
  }
}
