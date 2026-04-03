type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  returns?: Record<string, unknown>;
};

const INJECTION_PATTERNS: RegExp[] = [
  /ignore previous instructions/gi,
  /forget previous/gi,
  /disregard above/gi,
  /you are/gi,
  /you must/gi,
  /your role/gi,
  /system:/gi,
  /###/g,
  /```/g,
];

const HTML_SCRIPT_RE = /<script[^>]*>[\s\S]*?<\/script>/gi;
const HTML_STYLE_RE = /<style[^>]*>[\s\S]*?<\/style>/gi;
const HTML_TAG_RE = /<[^>]*>/g;

export function sanitizeDescription(desc: string): string {
  // 1. Truncate to 200 chars
  let result = desc.slice(0, 200);

  // 2. Strip prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // 3. Strip HTML tags (script/style with contents first, then remaining tags)
  result = result.replace(HTML_SCRIPT_RE, '');
  result = result.replace(HTML_STYLE_RE, '');
  result = result.replace(HTML_TAG_RE, '');

  // 4. Trim whitespace
  result = result.trim();

  // 5. Return plain text
  return result;
}

export function sanitizeToolSchema(schema: ToolSchema): ToolSchema {
  return {
    ...schema,
    name: schema.name.replace(/[^a-zA-Z0-9_]/g, ''),
    description: sanitizeDescription(schema.description),
  };
}
