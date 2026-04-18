const protectedHeadlinePhrases = [
  /\b(polovni)\s+(auto)\b/gi,
]

export function balanceHeadlineText(text: string) {
  let balanced = text

  protectedHeadlinePhrases.forEach((pattern) => {
    balanced = balanced.replace(pattern, '$1\u00A0$2')
  })

  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return balanced

  if (words.length === 2) {
    return text.length <= 18 ? balanced.replace(/\s+/, '\u00A0') : balanced
  }

  const lastSpace = balanced.lastIndexOf(' ')
  if (lastSpace === -1) return balanced

  return `${balanced.slice(0, lastSpace)}\u00A0${balanced.slice(lastSpace + 1)}`
}
