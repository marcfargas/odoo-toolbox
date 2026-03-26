import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve as resolvePath } from 'path';
import {
  renderMarkerValue,
  applyCss,
  extractTranslations,
  detectInstanceLanguage,
} from '../../src/engine/transform';
import { md, mdFile, withCss, translated } from '../../src/dsl/markers';

describe('renderMarkerValue', () => {
  const readFile = vi.fn();

  beforeEach(() => {
    readFile.mockReset();
  });

  it('passes plain strings through unchanged', async () => {
    const result = await renderMarkerValue('hello', '/project', readFile);
    expect(result).toBe('hello');
  });

  it('renders md() marker to HTML', async () => {
    const result = await renderMarkerValue(md('# Hello\n\nWorld'), '/project', readFile);
    expect(result).toContain('<h1>');
    expect(result).toContain('Hello');
    expect(result).toContain('<p>World</p>');
  });

  it('renders mdFile() marker by reading file and rendering', async () => {
    readFile.mockResolvedValue('# From File\n\nContent here');
    const marker = mdFile('./templates/welcome.md');

    const result = await renderMarkerValue(marker, '/project', readFile);

    expect(readFile).toHaveBeenCalledWith(resolvePath('/project', './templates/welcome.md'));
    expect(result).toContain('<h1>');
    expect(result).toContain('From File');
    expect(result).toContain('<p>Content here</p>');
  });

  it('resolves mdFile paths relative to project directory', async () => {
    readFile.mockResolvedValue('test');
    await renderMarkerValue(mdFile('./sub/dir/file.md'), '/my/project', readFile);
    expect(readFile).toHaveBeenCalledWith(resolvePath('/my/project', './sub/dir/file.md'));
  });

  it('passes through numbers, booleans, null unchanged', async () => {
    expect(await renderMarkerValue(42, '/p', readFile)).toBe(42);
    expect(await renderMarkerValue(true, '/p', readFile)).toBe(true);
    expect(await renderMarkerValue(null, '/p', readFile)).toBe(null);
  });
});

describe('applyCss', () => {
  const readFile = vi.fn();

  beforeEach(() => {
    readFile.mockReset();
  });

  it('inlines CSS into HTML style attributes by default', async () => {
    readFile.mockResolvedValue('h1 { color: red; }');
    const result = await applyCss('<h1>Hello</h1>', './style.css', true, '/project', readFile);
    expect(result).toContain('style=');
    expect(result).toContain('color');
    expect(result).toContain('red');
  });

  it('injects <style> block when inline=false', async () => {
    readFile.mockResolvedValue('h1 { color: blue; }');
    const result = await applyCss('<h1>Hello</h1>', './style.css', false, '/project', readFile);
    expect(result).toContain('<style>');
    expect(result).toContain('h1 { color: blue; }');
    expect(result).toContain('</style>');
  });
});

describe('renderMarkerValue with CSS markers', () => {
  const readFile = vi.fn();

  beforeEach(() => {
    readFile.mockReset();
  });

  it('processes withCss() marker: inlines CSS into HTML', async () => {
    readFile.mockResolvedValue('p { font-weight: bold; }');
    const marker = withCss('<p>Hi</p>', './s.css');
    const result = await renderMarkerValue(marker, '/project', readFile);
    expect(result).toContain('font-weight');
  });

  it('processes mdFile() with css option', async () => {
    readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('.md')) return '# Title';
      if (path.endsWith('.css')) return 'h1 { color: green; }';
      throw new Error(`unexpected read: ${path}`);
    });
    const marker = mdFile('./t.md', { css: './s.css' });
    const result = await renderMarkerValue(marker, '/project', readFile);
    expect(typeof result).toBe('string');
    expect(result as string).toContain('color');
  });
});

describe('extractTranslations', () => {
  const readFile = vi.fn();

  beforeEach(() => {
    readFile.mockReset();
  });

  it('extracts default value and translations from translated() marker', async () => {
    const values = {
      name: translated('Hola', { en_UK: 'Hello', ca_CA: 'Hola (cat)' }),
      active: true,
    };

    const { resolvedValues, translations } = await extractTranslations(
      values,
      '/project',
      readFile
    );

    expect(resolvedValues.name).toBe('Hola');
    expect(resolvedValues.active).toBe(true);

    expect(translations.entries).toEqual([
      { field: 'name', lang: 'en_UK', value: 'Hello' },
      { field: 'name', lang: 'ca_CA', value: 'Hola (cat)' },
    ]);
  });

  it('renders markdown inside translated() markers', async () => {
    const values = {
      body: translated(md('# Hola'), { en_UK: md('# Hello') }),
    };

    const { resolvedValues, translations } = await extractTranslations(
      values,
      '/project',
      readFile
    );

    expect(resolvedValues.body as string).toContain('<h1>');
    expect(translations.entries[0].value as string).toContain('<h1>');
    expect(translations.entries[0].value as string).toContain('Hello');
  });

  it('returns empty translations when no translated() markers', async () => {
    const values = { name: 'plain', active: true };
    const { resolvedValues, translations } = await extractTranslations(
      values,
      '/project',
      readFile
    );
    expect(resolvedValues).toEqual({ name: 'plain', active: true });
    expect(translations.entries).toEqual([]);
  });

  it('processes mdFile with CSS inside translated() markers', async () => {
    readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('.md')) return '**bold**';
      if (path.endsWith('.css')) return 'strong { color: red; }';
      throw new Error(`unexpected: ${path}`);
    });

    const values = {
      body: translated(mdFile('./es.md', { css: './s.css' }), { en_UK: mdFile('./en.md') }),
    };

    const { resolvedValues, translations } = await extractTranslations(
      values,
      '/project',
      readFile
    );

    expect(resolvedValues.body as string).toContain('color');
    expect(translations.entries[0].value as string).toContain('<strong>');
  });
});

describe('detectInstanceLanguage', () => {
  it('returns the default language from ir.config_parameter', async () => {
    const client = {
      searchRead: vi.fn().mockResolvedValue([{ value: 'es_ES' }]),
    };

    const lang = await detectInstanceLanguage(client as any);
    expect(lang).toBe('es_ES');
    expect(client.searchRead).toHaveBeenCalledWith(
      'ir.config_parameter',
      [['key', '=', 'web.base.lang']],
      { fields: ['value'], limit: 1 }
    );
  });

  it('falls back to res.lang active languages when config param not found', async () => {
    const client = {
      searchRead: vi
        .fn()
        .mockResolvedValueOnce([]) // ir.config_parameter empty
        .mockResolvedValueOnce([{ code: 'es_ES' }, { code: 'en_US' }]), // res.lang
    };

    const lang = await detectInstanceLanguage(client as any);
    expect(lang).toBe('es_ES');
  });

  it('defaults to en_US when no language info available', async () => {
    const client = {
      searchRead: vi.fn().mockResolvedValue([]),
    };

    const lang = await detectInstanceLanguage(client as any);
    expect(lang).toBe('en_US');
  });
});
