'use client'

// =============================================================================
// LegalBody — renders a legal-document section body string.
//
// Body strings (see src/i18n/locales/en.ts's legal.terms.*/legal.privacy.*
// keys) use "\n\n" for paragraph breaks and a "- " line prefix for bullet
// list items — a tiny convention, not a markdown library, kept deliberately
// simple so the SAME string is both the human-readable source text and the
// canonical text computeLegalContentHash() hashes.
// =============================================================================

interface Block {
  type: 'p' | 'ul'
  content: string | string[]
}

function parseLegalBody(body: string): Block[] {
  const paragraphs = body.split('\n\n')
  return paragraphs.map((chunk) => {
    const lines = chunk.split('\n')
    if (lines.every(line => line.startsWith('- '))) {
      return { type: 'ul', content: lines.map(line => line.slice(2)) }
    }
    return { type: 'p', content: chunk }
  })
}

export function LegalBody({ text }: Readonly<{ text: string }>) {
  const blocks = parseLegalBody(text)
  return (
    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((block, i) =>
        block.type === 'ul' ? (
          <ul key={i} style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(block.content as string[]).map((item, j) => (
              <li key={j} style={{ lineHeight: 1.7 }}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i} style={{ margin: 0 }}>{block.content as string}</p>
        )
      )}
    </div>
  )
}
