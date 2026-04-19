/** Minimal HTML entity escaping for user-controlled strings inserted into email HTML. */
export function escHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Replaces all `{{key}}` placeholders in a template string with the
 * corresponding values from the map. All replacements happen from the
 * original string so an early substitution cannot introduce new placeholders.
 */
export function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  )
}
