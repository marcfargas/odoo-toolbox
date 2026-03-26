import { marked } from 'marked';
import { resolve as resolvePath } from 'path';
import createDebug from 'debug';
import juice from 'juice';
import {
  isMdMarker,
  isMdFileMarker,
  isHtmlMarker,
  isCssMarker,
  isTranslatedMarker,
} from '../dsl/markers';
import type { TranslationMeta, TranslationEntry } from './types';

const debug = createDebug('odoo-state-manager:transform');

/** File reader function signature — injected for testability. */
export type FileReader = (absolutePath: string) => Promise<string>;

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

async function renderMarkdown(source: string): Promise<string> {
  const html = await marked.parse(source, { async: true });
  return html.trim();
}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

/**
 * Apply CSS to an HTML string.
 *
 * @param htmlContent - The HTML content
 * @param cssFile - Relative path to CSS file
 * @param inline - If true, inline styles into elements. If false, inject <style> block.
 * @param projectDir - Project root for resolving relative paths
 * @param readFile - File reader function
 */
export async function applyCss(
  htmlContent: string,
  cssFile: string,
  inline: boolean,
  projectDir: string,
  readFile: FileReader
): Promise<string> {
  const absPath = resolvePath(projectDir, cssFile);
  const css = await readFile(absPath);
  debug('apply CSS from %s (%d chars, inline=%s)', absPath, css.length, inline);

  if (inline) {
    return juice.inlineContent(htmlContent, css);
  }

  return `<style>${css}</style>\n${htmlContent}`;
}

// ---------------------------------------------------------------------------
// renderMarkerValue — process a single field value
// ---------------------------------------------------------------------------

/**
 * Process a field value, resolving any content markers into their final string form.
 *
 * - Plain values (string, number, boolean, null, arrays, objects): pass through
 * - MdMarker: render Markdown source to HTML
 * - MdFileMarker: read file, render Markdown to HTML
 * - HtmlMarker: unwrap to the raw value string
 * - Other markers (CssMarker, TranslatedMarker): handled by callers or later tasks
 */
export async function renderMarkerValue(
  value: unknown,
  projectDir: string,
  readFile: FileReader
): Promise<unknown> {
  if (isMdMarker(value)) {
    debug('render md marker (%d chars)', value.source.length);
    return renderMarkdown(value.source);
  }

  if (isMdFileMarker(value)) {
    const absPath = resolvePath(projectDir, value.path);
    debug('render mdFile marker: %s', absPath);
    const source = await readFile(absPath);
    const html = await renderMarkdown(source);
    if (value.css !== undefined) {
      return applyCss(html, value.css, value.inlineCss ?? true, projectDir, readFile);
    }
    return html;
  }

  if (isCssMarker(value)) {
    return applyCss(value.html, value.cssFile, value.inline ?? true, projectDir, readFile);
  }

  if (isHtmlMarker(value)) {
    return value.value;
  }

  // Non-marker values pass through
  return value;
}

// ---------------------------------------------------------------------------
// Sanitization heuristics
// ---------------------------------------------------------------------------

export interface SanitizationWarning {
  pattern: string;
  message: string;
}

/**
 * Heuristic check: scan HTML for patterns that Odoo's sanitizer would strip.
 * Returns warnings — not errors. The post-apply re-plan is the definitive check.
 */
export function checkSanitization(
  html: string,
  fieldAttrs: Record<string, unknown>
): SanitizationWarning[] {
  if (!fieldAttrs.sanitize) return [];

  const warnings: SanitizationWarning[] = [];

  // <script> — always stripped when sanitize=true
  if (/<script[\s>]/i.test(html)) {
    warnings.push({
      pattern: 'script',
      message: 'HTML contains <script> tag that will be stripped',
    });
  }

  // <style> blocks — stripped when sanitize_tags=true
  if (fieldAttrs.sanitize_tags !== false && /<style[\s>]/i.test(html)) {
    warnings.push({
      pattern: 'style',
      message: 'HTML contains <style> block likely stripped (sanitize_tags=true)',
    });
  }

  // Event handlers — stripped when sanitize_attributes=true
  if (fieldAttrs.sanitize_attributes !== false && /\bon\w+\s*=/i.test(html)) {
    warnings.push({
      pattern: 'event_handler',
      message: 'HTML contains event handler attributes likely stripped (sanitize_attributes=true)',
    });
  }

  // <form>, <input>, <select> — stripped when sanitize_form=true
  if (fieldAttrs.sanitize_form !== false && /<(form|input|select|textarea)[\s>]/i.test(html)) {
    warnings.push({
      pattern: 'form',
      message: 'HTML contains form elements likely stripped (sanitize_form=true)',
    });
  }

  // <iframe>, <embed>, <object> — always stripped when sanitize=true
  if (/<(iframe|embed|object)[\s>]/i.test(html)) {
    warnings.push({
      pattern: 'embed',
      message: 'HTML contains <iframe>/<embed>/<object> that will be stripped',
    });
  }

  // Conditional comments — stripped when sanitize_conditional_comments is not explicitly false
  if (fieldAttrs.sanitize_conditional_comments !== false && /<!--\[if/i.test(html)) {
    warnings.push({
      pattern: 'conditional_comment',
      message: 'HTML contains IE conditional comments likely stripped',
    });
  }

  // Inline style="" — stripped only when strip_style=true
  if (fieldAttrs.strip_style && /\bstyle\s*=/i.test(html)) {
    warnings.push({
      pattern: 'inline_style',
      message: 'HTML contains inline style attributes that will be stripped (strip_style=true)',
    });
  }

  // class="" — stripped only when strip_classes=true
  if (fieldAttrs.strip_classes && /\bclass\s*=/i.test(html)) {
    warnings.push({
      pattern: 'class',
      message: 'HTML contains class attributes that will be stripped (strip_classes=true)',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// extractTranslations — walk field values, extract translated() markers
// ---------------------------------------------------------------------------

/**
 * Process all field values, extracting translated() markers into separate
 * translation metadata and resolving the default value into resolvedValues.
 */
export async function extractTranslations(
  values: Record<string, unknown>,
  projectDir: string,
  readFile: FileReader
): Promise<{ resolvedValues: Record<string, unknown>; translations: TranslationMeta }> {
  const resolvedValues: Record<string, unknown> = {};
  const entries: TranslationEntry[] = [];

  for (const [field, value] of Object.entries(values)) {
    if (isTranslatedMarker(value)) {
      // Resolve the default value (may be md/mdFile/string)
      resolvedValues[field] = await renderMarkerValue(value.defaultValue, projectDir, readFile);

      // Resolve each translation
      for (const [lang, transValue] of Object.entries(value.translations)) {
        const resolved = await renderMarkerValue(transValue, projectDir, readFile);
        entries.push({ field, lang, value: resolved });
      }
    } else {
      // Process non-translated markers (md, mdFile, withCss, html, or plain values)
      resolvedValues[field] = await renderMarkerValue(value, projectDir, readFile);
    }
  }

  return { resolvedValues, translations: { entries } };
}
