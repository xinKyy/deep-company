const TG_MAX_LENGTH = 4096;

/**
 * Split a long message into chunks that fit within Telegram's 4096-char limit.
 * Prefers semantic boundaries: markdown headings > horizontal rules > paragraphs > lines.
 */
export function splitMessage(
  text: string,
  maxLength = TG_MAX_LENGTH
): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }

    const splitIndex = findSemanticBreak(remaining, maxLength);
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks.filter(Boolean);
}

function findSemanticBreak(text: string, maxLen: number): number {
  const window = text.slice(0, maxLen);

  // Priority 1: split before a top-level heading (# )
  const headingMatch = findLastPattern(window, /\n(?=# )/g);
  if (headingMatch > maxLen * 0.3) return headingMatch;

  // Priority 2: split at horizontal rule (---)
  const hrMatch = findLastPattern(window, /\n(?=---\s*\n)/g);
  if (hrMatch > maxLen * 0.3) return hrMatch;

  // Priority 3: split before any heading (## / ### / ...)
  const subHeadingMatch = findLastPattern(window, /\n(?=#{1,6} )/g);
  if (subHeadingMatch > maxLen * 0.3) return subHeadingMatch;

  // Priority 4: split at double newline (paragraph boundary)
  const paraMatch = findLastPattern(window, /\n\n/g);
  if (paraMatch > maxLen * 0.3) return paraMatch;

  // Priority 5: split at single newline
  const lineMatch = window.lastIndexOf("\n");
  if (lineMatch > maxLen * 0.2) return lineMatch;

  // Fallback: hard split at limit
  return maxLen;
}

function findLastPattern(text: string, pattern: RegExp): number {
  let last = -1;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    last = match.index;
  }
  return last;
}
