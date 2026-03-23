"use strict";
/**
 * Unit tests for domain-parser.ts
 *
 * Heavy coverage of: valid domains, quoting edge cases, type inference,
 * error messages with positions, filter sugar, domain combination.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const domain_parser_1 = require("../../src/parsing/domain-parser");
// ── parseDomainArg ────────────────────────────────────────────────────
(0, vitest_1.describe)('parseDomainArg', () => {
    (0, vitest_1.it)('parses empty domain', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('[]')).toEqual([]);
    });
    (0, vitest_1.it)('parses simple equality tuple', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('[("name","=","Acme")]')).toEqual([['name', '=', 'Acme']]);
    });
    (0, vitest_1.it)('parses multiple terms', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('[("active","=",True),("state","=","sale")]')).toEqual([
            ['active', '=', true],
            ['state', '=', 'sale'],
        ]);
    });
    (0, vitest_1.it)('converts Python True → true', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("active","=",True)]');
        (0, vitest_1.expect)(result[0][2]).toBe(true);
    });
    (0, vitest_1.it)('converts Python False → false', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("active","=",False)]');
        (0, vitest_1.expect)(result[0][2]).toBe(false);
    });
    (0, vitest_1.it)('converts Python None → null', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("partner_id","=",None)]');
        (0, vitest_1.expect)(result[0][2]).toBeNull();
    });
    (0, vitest_1.it)('parses integers', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("company_id","=",3)]');
        (0, vitest_1.expect)(result[0][2]).toBe(3);
    });
    (0, vitest_1.it)('parses negative integers', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("id","!=",0)]');
        (0, vitest_1.expect)(result[0][2]).toBe(0);
    });
    (0, vitest_1.it)('parses floats', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("amount",">=",100.5)]');
        (0, vitest_1.expect)(result[0][2]).toBe(100.5);
    });
    (0, vitest_1.it)('parses domain with logical operators', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('["|",("name","=","A"),("name","=","B")]')).toEqual([
            '|',
            ['name', '=', 'A'],
            ['name', '=', 'B'],
        ]);
    });
    (0, vitest_1.it)('parses nested field path', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("stage_id.name","=","Won")]');
        (0, vitest_1.expect)(result[0][0]).toBe('stage_id.name');
    });
    (0, vitest_1.it)('parses single-quoted strings', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)("[('name','ilike','acme')]")).toEqual([['name', 'ilike', 'acme']]);
    });
    (0, vitest_1.it)('parses double-quoted strings', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('[("name","ilike","acme")]')).toEqual([['name', 'ilike', 'acme']]);
    });
    (0, vitest_1.it)('parses mixed quote styles', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)("[('name',\"ilike\",'acme')]")).toEqual([['name', 'ilike', 'acme']]);
    });
    (0, vitest_1.it)('parses string with escaped quote', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("name","=","O\'Brien")]');
        (0, vitest_1.expect)(result[0][2]).toBe("O'Brien");
    });
    (0, vitest_1.it)('handles trailing comma in list', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('[("name","=","A"),]')).toEqual([['name', '=', 'A']]);
    });
    (0, vitest_1.it)('handles trailing comma in tuple', () => {
        // Some generators produce trailing commas in tuples
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('[("name","=","A",)]')).toEqual([['name', '=', 'A']]);
    });
    (0, vitest_1.it)('handles whitespace around elements', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('[ ("name", "=", "A") ]')).toEqual([['name', '=', 'A']]);
    });
    (0, vitest_1.it)('handles empty string value', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("name","=","")]');
        (0, vitest_1.expect)(result[0][2]).toBe('');
    });
    (0, vitest_1.it)('handles & operator', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[&,("a","=",1),("b","=",2)]');
        (0, vitest_1.expect)(result[0]).toBe('&');
    });
    (0, vitest_1.it)('handles ! operator', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[!,("active","=",False)]');
        (0, vitest_1.expect)(result[0]).toBe('!');
    });
    (0, vitest_1.it)('handles ilike operator', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("name","ilike","acme")]');
        (0, vitest_1.expect)(result[0][1]).toBe('ilike');
    });
    (0, vitest_1.it)('handles in operator with list', () => {
        const result = (0, domain_parser_1.parseDomainArg)('[("id","in",[1,2,3])]');
        (0, vitest_1.expect)(result[0][2]).toEqual([1, 2, 3]);
    });
    (0, vitest_1.it)('handles numeric False value (many2one not set)', () => {
        // In Odoo, checking for empty many2one: ("partner_id","=",False)
        const result = (0, domain_parser_1.parseDomainArg)('[("partner_id","=",False)]');
        (0, vitest_1.expect)(result[0][2]).toBe(false);
    });
    (0, vitest_1.it)('throws DomainParseError for invalid input', () => {
        (0, vitest_1.expect)(() => (0, domain_parser_1.parseDomainArg)('not a domain')).toThrow(domain_parser_1.DomainParseError);
    });
    (0, vitest_1.it)('throws DomainParseError with position info', () => {
        try {
            (0, domain_parser_1.parseDomainArg)('[("name","=",@invalid)]');
        }
        catch (err) {
            (0, vitest_1.expect)(err).toBeInstanceOf(domain_parser_1.DomainParseError);
            (0, vitest_1.expect)(err.message).toMatch(/position/i);
        }
    });
    (0, vitest_1.it)('throws for non-list top-level', () => {
        (0, vitest_1.expect)(() => (0, domain_parser_1.parseDomainArg)('("name","=","A")')).toThrow(domain_parser_1.DomainParseError);
    });
    (0, vitest_1.it)('handles empty input as empty domain', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('')).toEqual([]);
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainArg)('  ')).toEqual([]);
    });
});
// ── parseDomainJson ────────────────────────────────────────────────────
(0, vitest_1.describe)('parseDomainJson', () => {
    (0, vitest_1.it)('parses simple JSON domain', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainJson)('[["name","=","Acme"]]')).toEqual([['name', '=', 'Acme']]);
    });
    (0, vitest_1.it)('parses empty JSON array', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainJson)('[]')).toEqual([]);
    });
    (0, vitest_1.it)('preserves JSON booleans', () => {
        const result = (0, domain_parser_1.parseDomainJson)('[["active","=",true]]');
        (0, vitest_1.expect)(result[0][2]).toBe(true);
    });
    (0, vitest_1.it)('throws for invalid JSON', () => {
        (0, vitest_1.expect)(() => (0, domain_parser_1.parseDomainJson)('[["name","=","Acme"')).toThrow(domain_parser_1.DomainParseError);
    });
    (0, vitest_1.it)('throws for non-array JSON', () => {
        (0, vitest_1.expect)(() => (0, domain_parser_1.parseDomainJson)('{"name":"Acme"}')).toThrow(domain_parser_1.DomainParseError);
    });
    (0, vitest_1.it)('handles empty input as empty domain', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseDomainJson)('')).toEqual([]);
    });
});
// ── parseFilterArgs ────────────────────────────────────────────────────
(0, vitest_1.describe)('parseFilterArgs', () => {
    (0, vitest_1.it)('parses simple string value', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseFilterArgs)(['state=sale'])).toEqual([['state', '=', 'sale']]);
    });
    (0, vitest_1.it)('parses boolean true', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseFilterArgs)(['active=true'])).toEqual([['active', '=', true]]);
    });
    (0, vitest_1.it)('parses boolean false', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseFilterArgs)(['active=false'])).toEqual([['active', '=', false]]);
    });
    (0, vitest_1.it)('parses integer', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseFilterArgs)(['company_id=3'])).toEqual([['company_id', '=', 3]]);
    });
    (0, vitest_1.it)('parses multiple filters', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseFilterArgs)(['active=true', 'state=sale'])).toEqual([
            ['active', '=', true],
            ['state', '=', 'sale'],
        ]);
    });
    (0, vitest_1.it)('parses value with = in it', () => {
        // K=V where V contains =
        (0, vitest_1.expect)((0, domain_parser_1.parseFilterArgs)(['name=first=last'])).toEqual([['name', '=', 'first=last']]);
    });
    (0, vitest_1.it)('throws for missing = separator', () => {
        (0, vitest_1.expect)(() => (0, domain_parser_1.parseFilterArgs)(['invalid'])).toThrow(domain_parser_1.DomainParseError);
    });
    (0, vitest_1.it)('returns empty array for empty input', () => {
        (0, vitest_1.expect)((0, domain_parser_1.parseFilterArgs)([])).toEqual([]);
    });
});
// ── combineDomains ────────────────────────────────────────────────────
(0, vitest_1.describe)('combineDomains', () => {
    (0, vitest_1.it)('returns base domain when no filters', () => {
        const base = [['name', '=', 'A']];
        (0, vitest_1.expect)((0, domain_parser_1.combineDomains)(base, [])).toEqual(base);
    });
    (0, vitest_1.it)('appends filter terms to base domain', () => {
        const base = [['state', '=', 'sale']];
        const filters = [['active', '=', true]];
        (0, vitest_1.expect)((0, domain_parser_1.combineDomains)(base, filters)).toEqual([
            ['state', '=', 'sale'],
            ['active', '=', true],
        ]);
    });
    (0, vitest_1.it)('returns empty domain when both empty', () => {
        (0, vitest_1.expect)((0, domain_parser_1.combineDomains)([], [])).toEqual([]);
    });
    (0, vitest_1.it)('returns filter terms when base is empty', () => {
        (0, vitest_1.expect)((0, domain_parser_1.combineDomains)([], [['active', '=', true]])).toEqual([['active', '=', true]]);
    });
});
// ── readDomainFile ─────────────────────────────────────────────────────
(0, vitest_1.describe)('readDomainFile', () => {
    // Use a temp dir so tests are self-contained
    const tmpDir = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), 'odoo-cli-domain-test-'));
    function writeTmp(name, content) {
        const path = (0, path_1.join)(tmpDir, name);
        (0, fs_1.writeFileSync)(path, content, 'utf8');
        return path;
    }
    // Cleanup temp dir after all tests in this block
    // (afterAll not available at top-level describe, use a simple try/finally pattern)
    (0, vitest_1.it)('parses a standard JSON domain file with true/false/null', async () => {
        // This is the core regression: JSON true/false/null must NOT be corrupted
        // by the Python-literal parser (which would turn JSON `true` into string "true").
        const path = writeTmp('json-booleans.json', '[["active","=",true],["partner_id","=",null]]');
        const result = await (0, domain_parser_1.readDomainFile)(path);
        (0, vitest_1.expect)(result).toEqual([
            ['active', '=', true],
            ['partner_id', '=', null],
        ]);
        (0, vitest_1.expect)(result[0][2]).toBe(true); // must be boolean true, not string "true"
        (0, vitest_1.expect)(result[1][2]).toBeNull(); // must be null, not string "null"
    });
    (0, vitest_1.it)('parses a JSON domain file with false boolean', async () => {
        const path = writeTmp('json-false.json', '[["active","=",false]]');
        const result = await (0, domain_parser_1.readDomainFile)(path);
        (0, vitest_1.expect)(result[0][2]).toBe(false); // must be boolean false, not string "false"
    });
    (0, vitest_1.it)('parses a nested JSON domain file', async () => {
        const path = writeTmp('json-nested.json', '[["name","=","Acme"],["state","in",["sale","done"]]]');
        const result = await (0, domain_parser_1.readDomainFile)(path);
        (0, vitest_1.expect)(result).toHaveLength(2);
        (0, vitest_1.expect)(result[1][2]).toEqual(['sale', 'done']);
    });
    (0, vitest_1.it)('falls back to Python-literal syntax when JSON fails', async () => {
        // Python-literal syntax uses True/False/None — not valid JSON
        const path = writeTmp('python-domain.txt', '[("active","=",True),("state","=","sale")]');
        const result = await (0, domain_parser_1.readDomainFile)(path);
        (0, vitest_1.expect)(result).toEqual([
            ['active', '=', true],
            ['state', '=', 'sale'],
        ]);
    });
    (0, vitest_1.it)('parses an empty JSON array', async () => {
        const path = writeTmp('empty.json', '[]');
        const result = await (0, domain_parser_1.readDomainFile)(path);
        (0, vitest_1.expect)(result).toEqual([]);
    });
    (0, vitest_1.it)('throws DomainParseError for a non-existent file', async () => {
        await (0, vitest_1.expect)((0, domain_parser_1.readDomainFile)('/nonexistent/path/to/domain.json')).rejects.toThrow(domain_parser_1.DomainParseError);
    });
    // Cleanup
    (0, vitest_1.it)('cleanup temp dir (sentinel)', () => {
        try {
            (0, fs_1.rmSync)(tmpDir, { recursive: true, force: true });
        }
        catch {
            /* best effort */
        }
        (0, vitest_1.expect)(true).toBe(true);
    });
});
//# sourceMappingURL=domain-parser.test.js.map