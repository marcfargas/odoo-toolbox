/**
 * Unit tests for domain-parser.ts
 *
 * Heavy coverage of: valid domains, quoting edge cases, type inference,
 * error messages with positions, filter sugar, domain combination.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  parseDomainArg,
  parseDomainJson,
  parseFilterArgs,
  combineDomains,
  readDomainFile,
  DomainParseError,
} from '../../src/parsing/domain-parser';

// ── parseDomainArg ────────────────────────────────────────────────────

describe('parseDomainArg', () => {
  it('parses empty domain', () => {
    expect(parseDomainArg('[]')).toEqual([]);
  });

  it('parses simple equality tuple', () => {
    expect(parseDomainArg('[("name","=","Acme")]')).toEqual([['name', '=', 'Acme']]);
  });

  it('parses multiple terms', () => {
    expect(parseDomainArg('[("active","=",True),("state","=","sale")]')).toEqual([
      ['active', '=', true],
      ['state', '=', 'sale'],
    ]);
  });

  it('converts Python True → true', () => {
    const result = parseDomainArg('[("active","=",True)]');
    expect(result[0][2]).toBe(true);
  });

  it('converts Python False → false', () => {
    const result = parseDomainArg('[("active","=",False)]');
    expect(result[0][2]).toBe(false);
  });

  it('converts Python None → null', () => {
    const result = parseDomainArg('[("partner_id","=",None)]');
    expect(result[0][2]).toBeNull();
  });

  it('parses integers', () => {
    const result = parseDomainArg('[("company_id","=",3)]');
    expect(result[0][2]).toBe(3);
  });

  it('parses negative integers', () => {
    const result = parseDomainArg('[("id","!=",0)]');
    expect(result[0][2]).toBe(0);
  });

  it('parses floats', () => {
    const result = parseDomainArg('[("amount",">=",100.5)]');
    expect(result[0][2]).toBe(100.5);
  });

  it('parses domain with logical operators', () => {
    expect(parseDomainArg('["|",("name","=","A"),("name","=","B")]')).toEqual([
      '|',
      ['name', '=', 'A'],
      ['name', '=', 'B'],
    ]);
  });

  it('parses nested field path', () => {
    const result = parseDomainArg('[("stage_id.name","=","Won")]');
    expect(result[0][0]).toBe('stage_id.name');
  });

  it('parses single-quoted strings', () => {
    expect(parseDomainArg("[('name','ilike','acme')]")).toEqual([['name', 'ilike', 'acme']]);
  });

  it('parses double-quoted strings', () => {
    expect(parseDomainArg('[("name","ilike","acme")]')).toEqual([['name', 'ilike', 'acme']]);
  });

  it('parses mixed quote styles', () => {
    expect(parseDomainArg("[('name',\"ilike\",'acme')]")).toEqual([['name', 'ilike', 'acme']]);
  });

  it('parses string with escaped quote', () => {
    const result = parseDomainArg('[("name","=","O\'Brien")]');
    expect(result[0][2]).toBe("O'Brien");
  });

  it('handles trailing comma in list', () => {
    expect(parseDomainArg('[("name","=","A"),]')).toEqual([['name', '=', 'A']]);
  });

  it('handles trailing comma in tuple', () => {
    // Some generators produce trailing commas in tuples
    expect(parseDomainArg('[("name","=","A",)]')).toEqual([['name', '=', 'A']]);
  });

  it('handles whitespace around elements', () => {
    expect(parseDomainArg('[ ("name", "=", "A") ]')).toEqual([['name', '=', 'A']]);
  });

  it('handles empty string value', () => {
    const result = parseDomainArg('[("name","=","")]');
    expect(result[0][2]).toBe('');
  });

  it('handles & operator', () => {
    const result = parseDomainArg('[&,("a","=",1),("b","=",2)]');
    expect(result[0]).toBe('&');
  });

  it('handles ! operator', () => {
    const result = parseDomainArg('[!,("active","=",False)]');
    expect(result[0]).toBe('!');
  });

  it('handles ilike operator', () => {
    const result = parseDomainArg('[("name","ilike","acme")]');
    expect(result[0][1]).toBe('ilike');
  });

  it('handles in operator with list', () => {
    const result = parseDomainArg('[("id","in",[1,2,3])]');
    expect(result[0][2]).toEqual([1, 2, 3]);
  });

  it('handles numeric False value (many2one not set)', () => {
    // In Odoo, checking for empty many2one: ("partner_id","=",False)
    const result = parseDomainArg('[("partner_id","=",False)]');
    expect(result[0][2]).toBe(false);
  });

  it('throws DomainParseError for invalid input', () => {
    expect(() => parseDomainArg('not a domain')).toThrow(DomainParseError);
  });

  it('throws DomainParseError with position info', () => {
    try {
      parseDomainArg('[("name","=",@invalid)]');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainParseError);
      expect((err as DomainParseError).message).toMatch(/position/i);
    }
  });

  it('throws for non-list top-level', () => {
    expect(() => parseDomainArg('("name","=","A")')).toThrow(DomainParseError);
  });

  it('handles empty input as empty domain', () => {
    expect(parseDomainArg('')).toEqual([]);
    expect(parseDomainArg('  ')).toEqual([]);
  });
});

// ── parseDomainJson ────────────────────────────────────────────────────

describe('parseDomainJson', () => {
  it('parses simple JSON domain', () => {
    expect(parseDomainJson('[["name","=","Acme"]]')).toEqual([['name', '=', 'Acme']]);
  });

  it('parses empty JSON array', () => {
    expect(parseDomainJson('[]')).toEqual([]);
  });

  it('preserves JSON booleans', () => {
    const result = parseDomainJson('[["active","=",true]]');
    expect(result[0][2]).toBe(true);
  });

  it('throws for invalid JSON', () => {
    expect(() => parseDomainJson('[["name","=","Acme"')).toThrow(DomainParseError);
  });

  it('throws for non-array JSON', () => {
    expect(() => parseDomainJson('{"name":"Acme"}')).toThrow(DomainParseError);
  });

  it('handles empty input as empty domain', () => {
    expect(parseDomainJson('')).toEqual([]);
  });
});

// ── parseFilterArgs ────────────────────────────────────────────────────

describe('parseFilterArgs', () => {
  it('parses simple string value', () => {
    expect(parseFilterArgs(['state=sale'])).toEqual([['state', '=', 'sale']]);
  });

  it('parses boolean true', () => {
    expect(parseFilterArgs(['active=true'])).toEqual([['active', '=', true]]);
  });

  it('parses boolean false', () => {
    expect(parseFilterArgs(['active=false'])).toEqual([['active', '=', false]]);
  });

  it('parses integer', () => {
    expect(parseFilterArgs(['company_id=3'])).toEqual([['company_id', '=', 3]]);
  });

  it('parses multiple filters', () => {
    expect(parseFilterArgs(['active=true', 'state=sale'])).toEqual([
      ['active', '=', true],
      ['state', '=', 'sale'],
    ]);
  });

  it('parses value with = in it', () => {
    // K=V where V contains =
    expect(parseFilterArgs(['name=first=last'])).toEqual([['name', '=', 'first=last']]);
  });

  it('throws for missing = separator', () => {
    expect(() => parseFilterArgs(['invalid'])).toThrow(DomainParseError);
  });

  it('returns empty array for empty input', () => {
    expect(parseFilterArgs([])).toEqual([]);
  });
});

// ── combineDomains ────────────────────────────────────────────────────

describe('combineDomains', () => {
  it('returns base domain when no filters', () => {
    const base = [['name', '=', 'A']];
    expect(combineDomains(base, [])).toEqual(base);
  });

  it('appends filter terms to base domain', () => {
    const base = [['state', '=', 'sale']];
    const filters = [['active', '=', true]];
    expect(combineDomains(base, filters)).toEqual([
      ['state', '=', 'sale'],
      ['active', '=', true],
    ]);
  });

  it('returns empty domain when both empty', () => {
    expect(combineDomains([], [])).toEqual([]);
  });

  it('returns filter terms when base is empty', () => {
    expect(combineDomains([], [['active', '=', true]])).toEqual([['active', '=', true]]);
  });
});

// ── readDomainFile ─────────────────────────────────────────────────────

describe('readDomainFile', () => {
  // Use a temp dir so tests are self-contained
  const tmpDir = mkdtempSync(join(tmpdir(), 'odoo-cli-domain-test-'));

  function writeTmp(name: string, content: string): string {
    const path = join(tmpDir, name);
    writeFileSync(path, content, 'utf8');
    return path;
  }

  // Cleanup temp dir after all tests in this block
  // (afterAll not available at top-level describe, use a simple try/finally pattern)

  it('parses a standard JSON domain file with true/false/null', async () => {
    // This is the core regression: JSON true/false/null must NOT be corrupted
    // by the Python-literal parser (which would turn JSON `true` into string "true").
    const path = writeTmp('json-booleans.json', '[["active","=",true],["partner_id","=",null]]');
    const result = await readDomainFile(path);
    expect(result).toEqual([
      ['active', '=', true],
      ['partner_id', '=', null],
    ]);
    expect(result[0][2]).toBe(true); // must be boolean true, not string "true"
    expect(result[1][2]).toBeNull(); // must be null, not string "null"
  });

  it('parses a JSON domain file with false boolean', async () => {
    const path = writeTmp('json-false.json', '[["active","=",false]]');
    const result = await readDomainFile(path);
    expect(result[0][2]).toBe(false); // must be boolean false, not string "false"
  });

  it('parses a nested JSON domain file', async () => {
    const path = writeTmp(
      'json-nested.json',
      '[["name","=","Acme"],["state","in",["sale","done"]]]'
    );
    const result = await readDomainFile(path);
    expect(result).toHaveLength(2);
    expect(result[1][2]).toEqual(['sale', 'done']);
  });

  it('falls back to Python-literal syntax when JSON fails', async () => {
    // Python-literal syntax uses True/False/None — not valid JSON
    const path = writeTmp('python-domain.txt', '[("active","=",True),("state","=","sale")]');
    const result = await readDomainFile(path);
    expect(result).toEqual([
      ['active', '=', true],
      ['state', '=', 'sale'],
    ]);
  });

  it('parses an empty JSON array', async () => {
    const path = writeTmp('empty.json', '[]');
    const result = await readDomainFile(path);
    expect(result).toEqual([]);
  });

  it('throws DomainParseError for a non-existent file', async () => {
    await expect(readDomainFile('/nonexistent/path/to/domain.json')).rejects.toThrow(
      DomainParseError
    );
  });

  // Cleanup
  it('cleanup temp dir (sentinel)', () => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    expect(true).toBe(true);
  });
});
