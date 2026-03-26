import { marked } from 'marked';
import { resolve as resolvePath } from 'path';
import createDebug from 'debug';
import { isMdMarker, isMdFileMarker, isHtmlMarker } from '../dsl/markers';

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
    return renderMarkdown(source);
  }

  if (isHtmlMarker(value)) {
    return value.value;
  }

  // Non-marker values pass through
  return value;
}
