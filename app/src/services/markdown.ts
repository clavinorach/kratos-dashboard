/**
 * Markdown Rendering Service
 * 
 * Provides secure markdown-to-HTML conversion with XSS protection.
 * Uses marked for parsing and DOMPurify for sanitization.
 */

import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

// Create a DOMPurify instance with JSDOM window
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Renders markdown to safe HTML.
 * 
 * Parses raw markdown using marked and sanitizes the output
 * using DOMPurify to prevent XSS attacks. Only allows safe HTML
 * tags and attributes while blocking scripts, iframes, and other
 * potentially dangerous elements.
 * 
 * @param raw - Raw markdown content
 * @returns Sanitized HTML string safe for rendering
 */
export function renderMarkdown(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  // Parse markdown to HTML
  const html = marked.parse(raw) as string;

  // Sanitize HTML to prevent XSS
  const sanitized = purify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'u', 's', 'code', 'pre',
      'blockquote',
      'ul', 'ol', 'li',
      'a',
      'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',
      'src', 'alt', 'width', 'height',
      'class', 'id',
    ],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });

  return sanitized;
}

/**
 * Renders a preview of markdown (first N characters).
 * 
 * Useful for generating excerpts or summaries. Strips HTML tags
 * from the rendered markdown to produce plain text.
 * 
 * @param raw - Raw markdown content
 * @param maxLength - Maximum length of preview (default: 200)
 * @returns Plain text preview
 */
export function renderMarkdownPreview(raw: string, maxLength: number = 200): string {
  const html = renderMarkdown(raw);
  
  // Strip HTML tags for plain text preview
  const text = html.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength).trim() + '...';
}
