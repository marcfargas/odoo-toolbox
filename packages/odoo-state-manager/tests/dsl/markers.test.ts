import { describe, it, expect } from 'vitest';
import {
  md,
  mdFile,
  translated,
  withCss,
  html,
  isMdMarker,
  isMdFileMarker,
  isTranslatedMarker,
  isCssMarker,
  isHtmlMarker,
} from '../../src/dsl/markers';

describe('md()', () => {
  it('creates a frozen MdMarker with source string', () => {
    const marker = md('# Hello\n\nWorld');
    expect(marker.__type).toBe('md');
    expect(marker.source).toBe('# Hello\n\nWorld');
    expect(Object.isFrozen(marker)).toBe(true);
  });

  it('is detected by isMdMarker', () => {
    expect(isMdMarker(md('test'))).toBe(true);
    expect(isMdMarker({ __type: 'md' })).toBe(false);
    expect(isMdMarker(null)).toBe(false);
    expect(isMdMarker('string')).toBe(false);
  });
});

describe('mdFile()', () => {
  it('creates a frozen MdFileMarker with path', () => {
    const marker = mdFile('./templates/welcome.md');
    expect(marker.__type).toBe('mdFile');
    expect(marker.path).toBe('./templates/welcome.md');
    expect(marker.css).toBeUndefined();
    expect(marker.inlineCss).toBeUndefined();
    expect(Object.isFrozen(marker)).toBe(true);
  });

  it('accepts css and inlineCss options', () => {
    const marker = mdFile('./t.md', { css: './email.css', inlineCss: false });
    expect(marker.css).toBe('./email.css');
    expect(marker.inlineCss).toBe(false);
  });

  it('defaults inlineCss to undefined (resolved to true at transform time)', () => {
    const marker = mdFile('./t.md', { css: './email.css' });
    expect(marker.inlineCss).toBeUndefined();
  });

  it('is detected by isMdFileMarker', () => {
    expect(isMdFileMarker(mdFile('./t.md'))).toBe(true);
    expect(isMdFileMarker(md('test'))).toBe(false);
    expect(isMdFileMarker(null)).toBe(false);
  });
});

describe('translated()', () => {
  it('creates a frozen TranslatedMarker with default value', () => {
    const marker = translated('Hola');
    expect(marker.__type).toBe('translated');
    expect(marker.defaultValue).toBe('Hola');
    expect(marker.translations).toEqual({});
    expect(Object.isFrozen(marker)).toBe(true);
  });

  it('accepts translations map', () => {
    const marker = translated('Hola', { en_UK: 'Hello', ca_CA: 'Hola (cat)' });
    expect(marker.translations).toEqual({ en_UK: 'Hello', ca_CA: 'Hola (cat)' });
  });

  it('composes with md markers', () => {
    const marker = translated(md('# Hola'), { en_UK: md('# Hello') });
    expect(isMdMarker(marker.defaultValue)).toBe(true);
    expect(isMdMarker(marker.translations.en_UK)).toBe(true);
  });

  it('composes with mdFile markers', () => {
    const marker = translated(mdFile('./es.md', { css: './email.css' }), {
      en_UK: mdFile('./en.md'),
    });
    expect(isMdFileMarker(marker.defaultValue)).toBe(true);
    expect(isMdFileMarker(marker.translations.en_UK)).toBe(true);
  });

  it('is detected by isTranslatedMarker', () => {
    expect(isTranslatedMarker(translated('test'))).toBe(true);
    expect(isTranslatedMarker(md('test'))).toBe(false);
    expect(isTranslatedMarker(null)).toBe(false);
  });
});

describe('withCss()', () => {
  it('creates a frozen CssMarker with html and cssFile', () => {
    const marker = withCss('<div>Hi</div>', './style.css');
    expect(marker.__type).toBe('css');
    expect(marker.html).toBe('<div>Hi</div>');
    expect(marker.cssFile).toBe('./style.css');
    expect(marker.inline).toBeUndefined();
    expect(Object.isFrozen(marker)).toBe(true);
  });

  it('accepts inline option', () => {
    const marker = withCss('<div>Hi</div>', './s.css', { inline: false });
    expect(marker.inline).toBe(false);
  });

  it('is detected by isCssMarker', () => {
    expect(isCssMarker(withCss('<div/>', './s.css'))).toBe(true);
    expect(isCssMarker(md('test'))).toBe(false);
  });
});

describe('html()', () => {
  it('creates a frozen HtmlMarker with value', () => {
    const marker = html('<div>test</div>');
    expect(marker.__type).toBe('html');
    expect(marker.value).toBe('<div>test</div>');
    expect(marker.verify).toBeUndefined();
    expect(Object.isFrozen(marker)).toBe(true);
  });

  it('accepts verify: false option', () => {
    const marker = html('<div>test</div>', { verify: false });
    expect(marker.verify).toBe(false);
  });

  it('is detected by isHtmlMarker', () => {
    expect(isHtmlMarker(html('<div/>'))).toBe(true);
    expect(isHtmlMarker(md('test'))).toBe(false);
  });
});
