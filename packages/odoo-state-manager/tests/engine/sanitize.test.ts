import { describe, it, expect } from 'vitest';
import { checkSanitization } from '../../src/engine/transform';

function makeFieldAttrs(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sanitize: true,
    sanitize_tags: true,
    sanitize_attributes: true,
    sanitize_style: false,
    sanitize_form: true,
    strip_style: false,
    strip_classes: false,
    ...overrides,
  };
}

describe('checkSanitization', () => {
  it('warns about <script> tags when sanitize=true', () => {
    const warnings = checkSanitization('<p>ok</p><script>alert(1)</script>', makeFieldAttrs());
    expect(warnings).toContainEqual(expect.objectContaining({ pattern: 'script' }));
  });

  it('warns about <style> blocks when sanitize_tags=true', () => {
    const warnings = checkSanitization('<style>h1{color:red}</style><h1>Hi</h1>', makeFieldAttrs());
    expect(warnings).toContainEqual(expect.objectContaining({ pattern: 'style' }));
  });

  it('does not warn about <style> when sanitize_tags=false', () => {
    const warnings = checkSanitization(
      '<style>h1{}</style>',
      makeFieldAttrs({ sanitize_tags: false })
    );
    expect(warnings.find((w) => w.pattern === 'style')).toBeUndefined();
  });

  it('warns about event handlers when sanitize_attributes=true', () => {
    const warnings = checkSanitization('<div onclick="alert(1)">Hi</div>', makeFieldAttrs());
    expect(warnings).toContainEqual(expect.objectContaining({ pattern: 'event_handler' }));
  });

  it('warns about <form> elements when sanitize_form=true', () => {
    const warnings = checkSanitization('<form><input type="text"></form>', makeFieldAttrs());
    expect(warnings).toContainEqual(expect.objectContaining({ pattern: 'form' }));
  });

  it('warns about <iframe> when sanitize=true', () => {
    const warnings = checkSanitization('<iframe src="http://evil.com"></iframe>', makeFieldAttrs());
    expect(warnings).toContainEqual(expect.objectContaining({ pattern: 'embed' }));
  });

  it('warns about inline style attrs when strip_style=true', () => {
    const warnings = checkSanitization(
      '<p style="color:red">Hi</p>',
      makeFieldAttrs({ strip_style: true })
    );
    expect(warnings).toContainEqual(expect.objectContaining({ pattern: 'inline_style' }));
  });

  it('warns about class attrs when strip_classes=true', () => {
    const warnings = checkSanitization(
      '<p class="foo">Hi</p>',
      makeFieldAttrs({ strip_classes: true })
    );
    expect(warnings).toContainEqual(expect.objectContaining({ pattern: 'class' }));
  });

  it('returns empty array for clean HTML', () => {
    const warnings = checkSanitization('<p>Hello <strong>world</strong></p>', makeFieldAttrs());
    expect(warnings).toEqual([]);
  });

  it('returns empty array when sanitize=false', () => {
    const warnings = checkSanitization('<script>x</script>', makeFieldAttrs({ sanitize: false }));
    expect(warnings).toEqual([]);
  });
});
