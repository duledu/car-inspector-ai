// Server Component — renders a JSON-LD <script> tag.
// Safe: content is a static JSON string, no hydration mismatch.

export default function JsonLd({
  schema,
}: Readonly<{ schema: Record<string, unknown> }>) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
