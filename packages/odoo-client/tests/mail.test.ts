/**
 * Unit tests for mail helpers: ensureHtmlBody, postInternalNote, postOpenMessage
 */

import { ensureHtmlBody } from '../src/services/mail/functions';
import { OdooValidationError } from '../src/types/errors';

describe('ensureHtmlBody', () => {
  it('should throw on empty string', () => {
    expect(() => ensureHtmlBody('')).toThrow(OdooValidationError);
    expect(() => ensureHtmlBody('')).toThrow(/body must not be empty/);
  });

  it('should throw on whitespace-only string', () => {
    expect(() => ensureHtmlBody('   ')).toThrow(OdooValidationError);
    expect(() => ensureHtmlBody('\n\t ')).toThrow(OdooValidationError);
  });

  it('should wrap plain text in <p> tags', () => {
    expect(ensureHtmlBody('Hello world')).toBe('<p>Hello world</p>');
  });

  it('should trim whitespace before wrapping', () => {
    expect(ensureHtmlBody('  Hello  ')).toBe('<p>Hello</p>');
  });

  it('should pass through HTML starting with a tag', () => {
    const html = '<p>Already <b>formatted</b></p>';
    expect(ensureHtmlBody(html)).toBe(html);
  });

  it('should pass through complex HTML as-is', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(ensureHtmlBody(html)).toBe(html);
  });

  it('should trim surrounding whitespace from HTML', () => {
    expect(ensureHtmlBody('  <p>Trimmed</p>  ')).toBe('<p>Trimmed</p>');
  });

  it('should include helpful examples in error message', () => {
    try {
      ensureHtmlBody('');
      fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(OdooValidationError);
      expect((e as Error).message).toContain('<p>');
      expect((e as Error).message).toContain('plain text');
    }
  });
});
