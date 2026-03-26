// ---------------------------------------------------------------------------
// Marker interfaces
// ---------------------------------------------------------------------------

export interface MdMarker {
  readonly __type: 'md';
  readonly source: string;
}

export interface MdFileMarker {
  readonly __type: 'mdFile';
  readonly path: string;
  readonly css?: string;
  readonly inlineCss?: boolean;
}

export interface TranslatedMarker {
  readonly __type: 'translated';
  readonly defaultValue: string | MdMarker | MdFileMarker;
  readonly translations: Record<string, string | MdMarker | MdFileMarker>;
}

export interface CssMarker {
  readonly __type: 'css';
  readonly html: string;
  readonly cssFile: string;
  readonly inline?: boolean;
}

export interface HtmlMarker {
  readonly __type: 'html';
  readonly value: string;
  readonly verify?: boolean;
}

/** Any marker type that can appear as a field value. */
export type ContentMarker = MdMarker | MdFileMarker | TranslatedMarker | CssMarker | HtmlMarker;

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function md(source: string): MdMarker {
  return Object.freeze({ __type: 'md' as const, source });
}

export function mdFile(path: string, opts?: { css?: string; inlineCss?: boolean }): MdFileMarker {
  return Object.freeze({
    __type: 'mdFile' as const,
    path,
    ...(opts?.css !== undefined ? { css: opts.css } : {}),
    ...(opts?.inlineCss !== undefined ? { inlineCss: opts.inlineCss } : {}),
  });
}

export function translated(
  defaultValue: string | MdMarker | MdFileMarker,
  translations: Record<string, string | MdMarker | MdFileMarker> = {}
): TranslatedMarker {
  return Object.freeze({
    __type: 'translated' as const,
    defaultValue,
    translations: Object.freeze({ ...translations }),
  });
}

export function withCss(html: string, cssFile: string, opts?: { inline?: boolean }): CssMarker {
  return Object.freeze({
    __type: 'css' as const,
    html,
    cssFile,
    ...(opts?.inline !== undefined ? { inline: opts.inline } : {}),
  });
}

export function html(value: string, opts?: { verify?: boolean }): HtmlMarker {
  return Object.freeze({
    __type: 'html' as const,
    value,
    ...(opts?.verify !== undefined ? { verify: opts.verify } : {}),
  });
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isMdMarker(v: unknown): v is MdMarker {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as any).__type === 'md' &&
    typeof (v as any).source === 'string'
  );
}

export function isMdFileMarker(v: unknown): v is MdFileMarker {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as any).__type === 'mdFile' &&
    typeof (v as any).path === 'string'
  );
}

export function isTranslatedMarker(v: unknown): v is TranslatedMarker {
  return typeof v === 'object' && v !== null && (v as any).__type === 'translated';
}

export function isCssMarker(v: unknown): v is CssMarker {
  return typeof v === 'object' && v !== null && (v as any).__type === 'css';
}

export function isHtmlMarker(v: unknown): v is HtmlMarker {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as any).__type === 'html' &&
    typeof (v as any).value === 'string'
  );
}

export function isContentMarker(v: unknown): v is ContentMarker {
  return (
    isMdMarker(v) || isMdFileMarker(v) || isTranslatedMarker(v) || isCssMarker(v) || isHtmlMarker(v)
  );
}
