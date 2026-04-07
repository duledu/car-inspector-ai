# CURRENT PRIORITY: VEHICLE AI RESEARCH

This is a CORE feature of the application.

The goal is to provide real, useful, actionable insights before the inspection starts.

---

## INPUT

User provides:

- make (brand)
- model
- year
- optional: engine / trim

---

## REQUIRED BEHAVIOR

When vehicle data is provided:

1. MUST perform real-world research using available tools (web/search/API)

2. MUST identify:

- common mechanical issues
- known weak points
- recurring failures (from forums, reports, mechanics insights)

3. MUST transform raw data into structured, user-friendly output

---

## OUTPUT STRUCTURE (MANDATORY)

## OUTPUT STRUCTURE (MANDATORY)

Always return these sections:

### 1. Known Weaknesses

- list of common failures for this vehicle
- short explanation (1–2 lines per item)
- include severity (low / medium / high)

### 2. What to Inspect Physically

- concrete inspection checklist
- visual/mechanical things user can verify

### 3. Expensive Repairs to Watch

- high-cost risks
- items useful for negotiation

### 4. Test Drive Warning Signs

- symptoms during driving
- sounds, behavior, performance issues

## DATA QUALITY RULES

- DO NOT guess generic answers
- DO NOT return vague AI filler content
- PRIORITIZE real-world patterns over assumptions
- If multiple sources disagree → return most common issues

---

## FALLBACK SYSTEM (CRITICAL)

I## FALLBACK SYSTEM (CRITICAL)

If web/API research fails:

1. fallback to internal knowledge base

2. fallback to brand-level common issues

3. generate best possible structured output

### NEVER

- return empty state
- show raw error to user
- block the flow

### Instead show

"Limited data mode — showing known patterns for this vehicle"

## UX REQUIREMENTS

- output must be scannable (not long paragraphs)
- use bullet points
- keep explanations short and clear
- prioritize clarity over completeness

---

## PERFORMANCE RULES

- avoid long blocking operations
- use async approach where possible
- allow partial results if full research is slow

---

## FAILURE HANDLING

If something breaks:

- retry once automatically
- fallback immediately after failure
- always return usable output

---

## FINAL RULE

## FINAL RULE

The user must ALWAYS receive useful insights,  
even if external systems fail.
