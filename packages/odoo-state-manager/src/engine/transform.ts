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
