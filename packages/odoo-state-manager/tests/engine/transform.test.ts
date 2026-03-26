import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve as resolvePath } from 'path';
import { renderMarkerValue, applyCss } from '../../src/engine/transform';
import { md, mdFile, withCss } from '../../src/dsl/markers';

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
