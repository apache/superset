/**
 * Server-side HTML sanitization using the same rehype-sanitize pipeline
 * that SafeMarkdown uses in the browser.
 *
 * Accepts an optional schemaOverrides parameter that mirrors Superset's
 * HTML_SANITIZATION_SCHEMA_EXTENSIONS config — the MCP tool reads this
 * from the Flask config and passes it through, so the sidecar's
 * sanitization always matches the browser's.
 */

export interface SchemaOverrides {
  attributes?: Record<string, Array<string | [string, ...unknown[]]>>;
  tagNames?: string[];
  [key: string]: unknown;
}

export async function sanitizeHtml(
  html: string,
  schemaOverrides?: SchemaOverrides,
): Promise<string> {
  const { unified } = await import('unified');
  const rehypeParse = (await import('rehype-parse')).default;
  const rehypeRaw = (await import('rehype-raw')).default;
  const rehypeSanitize = (await import('rehype-sanitize')).default;
  const { defaultSchema } = await import('rehype-sanitize');
  const rehypeStringify = (await import('rehype-stringify')).default;

  // Merge overrides into the default schema, same as SafeMarkdown does
  const schema: any = { ...defaultSchema };
  if (schemaOverrides) {
    if (schemaOverrides.attributes) {
      schema.attributes = {
        ...schema.attributes,
        ...schemaOverrides.attributes,
      };
    }
    if (schemaOverrides.tagNames) {
      schema.tagNames = [
        ...(schema.tagNames || []),
        ...schemaOverrides.tagNames,
      ];
    }
  }

  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeStringify);

  const result = await processor.process(html);
  return String(result);
}
