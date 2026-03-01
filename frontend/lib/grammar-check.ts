/**
 * Grammar and spell checking utilities
 * Uses LanguageTool API for grammar checking
 */

export interface GrammarError {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
  rule: {
    id: string;
    description: string;
  };
}

export interface GrammarCheckResult {
  errors: GrammarError[];
  hasErrors: boolean;
}

/**
 * Check grammar using LanguageTool API
 * LanguageTool offers a free public API (rate limited)
 */
export async function checkGrammar(
  text: string,
  language: string = 'en-US'
): Promise<GrammarCheckResult> {
  if (!text || text.trim().length === 0) {
    return { errors: [], hasErrors: false };
  }

  try {
    // Use LanguageTool public API (free tier, rate limited to ~20 requests/day per IP)
    // For production, consider using your own LanguageTool server or API key
    const response = await fetch(
      `https://api.languagetool.org/v2/check?text=${encodeURIComponent(text)}&language=${language}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: `text=${encodeURIComponent(text)}&language=${language}`,
      }
    );

    if (!response.ok) {
      throw new Error('Grammar check API request failed');
    }

    const data = await response.json();

    const errors: GrammarError[] = (data.matches || []).map((match: any) => ({
      offset: match.offset,
      length: match.length,
      message: match.message,
      replacements: match.replacements?.map((r: any) => r.value) || [],
      rule: {
        id: match.rule?.id || '',
        description: match.rule?.description || '',
      },
    }));

    return {
      errors,
      hasErrors: errors.length > 0,
    };
  } catch (error) {
    console.error('Grammar check error:', error);
    // Return empty result on error (don't block user)
    return { errors: [], hasErrors: false };
  }
}

/**
 * Extract plain text from HTML content
 */
export function extractTextFromHTML(html: string): string {
  if (typeof document === 'undefined') {
    // Server-side: simple regex extraction
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Client-side: use DOM
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Apply grammar suggestions to HTML content
 * This is a simplified version - for better accuracy, consider using a proper HTML parser
 */
export function applySuggestion(
  html: string,
  offset: number,
  length: number,
  replacement: string
): string {
  const text = extractTextFromHTML(html);
  
  if (offset + length > text.length || offset < 0) {
    return html; // Invalid offset/length
  }

  // Simple approach: find the text in HTML and replace it
  // This works for simple cases but may not handle all HTML structures perfectly
  const textToReplace = text.substring(offset, offset + length);
  
  // Try to find and replace the text while preserving HTML structure
  // For better results, we'll use a more sophisticated approach
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    const walker = document.createTreeWalker(
      div,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let found = false;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent) continue;

      const nodeLength = node.textContent.length;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + nodeLength;

      // Check if the error spans this text node
      if (offset >= nodeStart && offset < nodeEnd) {
        const relativeOffset = offset - nodeStart;
        const replaceLength = Math.min(length, nodeEnd - offset);
        
        if (node.textContent) {
          const before = node.textContent.substring(0, relativeOffset);
          const after = node.textContent.substring(relativeOffset + replaceLength);
          node.textContent = before + replacement + after;
          found = true;
          break;
        }
      }

      currentOffset = nodeEnd;
    }

    if (found) {
      return div.innerHTML;
    }
  }

  // Fallback: simple text replacement (may break HTML structure)
  return html.replace(textToReplace, replacement);
}

