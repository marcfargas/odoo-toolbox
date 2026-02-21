/**
 * Odoo domain parser — tokenizer + recursive descent parser.
 *
 * Parses the Python-literal subset used in Odoo domain expressions:
 *
 *   '[("stage_id.name","=","Won"),("active","=",True)]'
 *   '["|",("name","ilike","acme"),("ref","ilike","acme")]'
 *
 * Converts Python literals to JSON-compatible values:
 *   True  → true
 *   False → false
 *   None  → null
 *   (a,b) → [a, b]  (tuples become arrays)
 *
 * Three input paths:
 *   parseDomainArg()    - from --domain flag (Python literal syntax)
 *   parseDomainJson()   - from --domain-json flag (strict JSON)
 *   parseFilterArgs()   - from --filter K=V pairs (simple equality)
 */

import debug from 'debug';

const log = debug('odoo-cli:domain-parser');

// ── Errors ──────────────────────────────────────────────────────────

export class DomainParseError extends Error {
  constructor(
    message: string,
    public readonly position?: number,
    public readonly input?: string
  ) {
    const posHint =
      position !== undefined && input !== undefined
        ? `\n  at position ${position}: ...${input.slice(Math.max(0, position - 10), position + 10)}...`
        : '';
    super(message + posHint);
    this.name = 'DomainParseError';
  }
}

// ── Tokenizer ────────────────────────────────────────────────────────

type TokenType =
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'STRING'
  | 'NUMBER'
  | 'IDENT'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    // Single-char tokens
    if (input[i] === '[') {
      tokens.push({ type: 'LBRACKET', value: '[', pos: i });
      i++;
      continue;
    }
    if (input[i] === ']') {
      tokens.push({ type: 'RBRACKET', value: ']', pos: i });
      i++;
      continue;
    }
    if (input[i] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i });
      i++;
      continue;
    }
    if (input[i] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i });
      i++;
      continue;
    }
    if (input[i] === ',') {
      tokens.push({ type: 'COMMA', value: ',', pos: i });
      i++;
      continue;
    }

    // String literals — single or double quoted
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      const start = i;
      i++;
      let str = '';
      while (i < input.length) {
        if (input[i] === '\\' && i + 1 < input.length) {
          const esc = input[i + 1];
          switch (esc) {
            case 'n':
              str += '\n';
              break;
            case 't':
              str += '\t';
              break;
            case 'r':
              str += '\r';
              break;
            case '\\':
              str += '\\';
              break;
            case "'":
              str += "'";
              break;
            case '"':
              str += '"';
              break;
            default:
              str += esc;
          }
          i += 2;
          continue;
        }
        if (input[i] === quote) {
          i++;
          break;
        }
        str += input[i];
        i++;
      }
      tokens.push({ type: 'STRING', value: str, pos: start });
      continue;
    }

    // Numbers (including negative)
    if (/[-\d]/.test(input[i]) && (input[i] !== '-' || /\d/.test(input[i + 1] ?? ''))) {
      const start = i;
      let num = '';
      if (input[i] === '-') {
        num += '-';
        i++;
      }
      while (i < input.length && /[\d.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num, pos: start });
      continue;
    }

    // Identifiers: True, False, None, operators like &, |, !
    if (/[a-zA-Z_&|!]/.test(input[i])) {
      const start = i;
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_.&|!]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident, pos: start });
      continue;
    }

    throw new DomainParseError(`Unexpected character '${input[i]}'`, i, input);
  }

  tokens.push({ type: 'EOF', value: '', pos: input.length });
  return tokens;
}

// ── Parser ───────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(
    private input: string,
    tokens: Token[]
  ) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new DomainParseError(
        `Expected ${type} but got ${tok.type} ('${tok.value}')`,
        tok.pos,
        this.input
      );
    }
    return this.consume();
  }

  parseValue(): any {
    const tok = this.peek();

    switch (tok.type) {
      case 'LBRACKET':
        return this.parseList();
      case 'LPAREN':
        return this.parseTuple();
      case 'STRING':
        this.consume();
        return tok.value;
      case 'NUMBER': {
        this.consume();
        const n = tok.value.includes('.') ? parseFloat(tok.value) : parseInt(tok.value, 10);
        if (isNaN(n))
          throw new DomainParseError(`Invalid number '${tok.value}'`, tok.pos, this.input);
        return n;
      }
      case 'IDENT': {
        this.consume();
        switch (tok.value) {
          case 'True':
            return true;
          case 'False':
            return false;
          case 'None':
            return null;
          // Logic operators are valid as strings in domains
          case '&':
          case '|':
          case '!':
            return tok.value;
          default:
            // Could be a bare identifier used as a string in some edge cases
            return tok.value;
        }
      }
      default:
        throw new DomainParseError(
          `Unexpected token ${tok.type} ('${tok.value}')`,
          tok.pos,
          this.input
        );
    }
  }

  parseList(): any[] {
    this.expect('LBRACKET');
    const items: any[] = [];

    if (this.peek().type === 'RBRACKET') {
      this.consume();
      return items;
    }

    items.push(this.parseValue());

    while (this.peek().type === 'COMMA') {
      this.consume();
      // Trailing comma
      if (this.peek().type === 'RBRACKET') break;
      items.push(this.parseValue());
    }

    this.expect('RBRACKET');
    return items;
  }

  parseTuple(): any[] {
    // Tuples → arrays (same as list but with parens)
    this.expect('LPAREN');
    const items: any[] = [];

    if (this.peek().type === 'RPAREN') {
      this.consume();
      return items;
    }

    items.push(this.parseValue());

    while (this.peek().type === 'COMMA') {
      this.consume();
      if (this.peek().type === 'RPAREN') break;
      items.push(this.parseValue());
    }

    this.expect('RPAREN');
    return items;
  }

  parse(): any[] {
    const result = this.parseList();
    if (this.peek().type !== 'EOF') {
      const tok = this.peek();
      throw new DomainParseError(
        `Unexpected token after domain end: ${tok.type} ('${tok.value}')`,
        tok.pos,
        this.input
      );
    }
    return result;
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Parse an Odoo domain string (Python literal syntax) into a JSON array.
 *
 * @example
 *   parseDomainArg('[("name","ilike","acme"),("active","=",True)]')
 *   // → [["name","ilike","acme"],["active","=",true]]
 */
export function parseDomainArg(input: string): any[] {
  log('Parsing domain: %s', input);
  const trimmed = input.trim();
  if (!trimmed) return [];

  try {
    const tokens = tokenize(trimmed);
    const parser = new Parser(trimmed, tokens);
    const result = parser.parse();

    if (!Array.isArray(result)) {
      throw new DomainParseError('Domain must be a list', 0, trimmed);
    }

    log('Parsed domain: %O', result);
    return result;
  } catch (err) {
    if (err instanceof DomainParseError) throw err;
    throw new DomainParseError(
      `Failed to parse domain: ${err instanceof Error ? err.message : String(err)}`,
      0,
      trimmed
    );
  }
}

/**
 * Parse a strict JSON domain string.
 *
 * @example
 *   parseDomainJson('[["name","ilike","acme"]]')
 */
export function parseDomainJson(input: string): any[] {
  log('Parsing JSON domain: %s', input);
  const trimmed = input.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new DomainParseError(
      `Invalid JSON domain: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new DomainParseError('Domain must be a JSON array');
  }

  return parsed;
}

/**
 * Parse --filter K=V pairs into domain terms.
 *
 * Type inference:
 *   "true"/"false"       → boolean
 *   all-digit string     → integer
 *   otherwise            → string
 *
 * @example
 *   parseFilterArgs(['active=true', 'state=sale'])
 *   // → [['active','=',true],['state','=','sale']]
 */
export function parseFilterArgs(filters: string[]): any[][] {
  return filters.map((f) => {
    const eqIdx = f.indexOf('=');
    if (eqIdx === -1) {
      throw new DomainParseError(`Invalid --filter format (expected K=V): '${f}'`);
    }
    const key = f.slice(0, eqIdx).trim();
    const rawVal = f.slice(eqIdx + 1);

    let value: unknown;
    if (rawVal === 'true') value = true;
    else if (rawVal === 'false') value = false;
    else if (/^\d+$/.test(rawVal)) value = parseInt(rawVal, 10);
    else value = rawVal;

    return [key, '=', value];
  });
}

/**
 * Combine a base domain with filter terms (AND).
 */
export function combineDomains(baseDomain: any[], filterTerms: any[][]): any[] {
  if (filterTerms.length === 0) return baseDomain;
  return [...baseDomain, ...filterTerms];
}

/**
 * Read domain from a file path. '-' reads from stdin.
 */
export async function readDomainFile(filePath: string): Promise<any[]> {
  const { readFileSync } = await import('fs');
  let content: string;

  if (filePath === '-') {
    // Read from stdin
    content = await readStdin();
  } else {
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (err) {
      throw new DomainParseError(
        `Cannot read domain file '${filePath}': ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const trimmed = content.trim();
  // Try JSON first (standard): JSON true/false/null must not be corrupted by Python-literal parser.
  // Fall back to Python-literal syntax only if JSON.parse fails.
  try {
    return parseDomainJson(trimmed);
  } catch {
    // fall back to Python-literal syntax (handles True/False/None)
  }
  return parseDomainArg(trimmed);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}
