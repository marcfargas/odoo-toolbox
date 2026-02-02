/**
 * Markdown code example tester
 *
 * Extracts testable code blocks from markdown files.
 * Code blocks marked with `testable` in their fence metadata are extracted.
 *
 * Example:
 * ```typescript testable id="basic-connection" needs="client" expect="session !== null"
 * const session = client.getSession();
 * ```
 */

export interface TestableBlock {
  id: string;
  sourceFile: string;
  lineNumber: number;
  code: string;
  language: string;
  needs: string[];
  creates?: string;
  expect?: string;
  skip?: string;
}

/**
 * Extract testable code blocks from markdown content
 */
export function extractTestableBlocks(
  content: string,
  sourceFile: string
): TestableBlock[] {
  const blocks: TestableBlock[] = [];
  const lines = content.split('\n');

  let inCodeBlock = false;
  let codeBlockStart = 0;
  let codeBlockMeta = '';
  let codeBlockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inCodeBlock && line.startsWith('```')) {
      inCodeBlock = true;
      codeBlockStart = i + 1; // 1-indexed
      codeBlockMeta = line.slice(3).trim();
      codeBlockContent = [];
    } else if (inCodeBlock && line.startsWith('```')) {
      inCodeBlock = false;

      // Check if this block is testable
      if (codeBlockMeta.includes('testable')) {
        const block = parseTestableBlock(
          codeBlockMeta,
          codeBlockContent.join('\n'),
          sourceFile,
          codeBlockStart
        );
        if (block) {
          blocks.push(block);
        }
      }
    } else if (inCodeBlock) {
      codeBlockContent.push(line);
    }
  }

  return blocks;
}

/**
 * Parse testable block metadata
 */
function parseTestableBlock(
  meta: string,
  code: string,
  sourceFile: string,
  lineNumber: number
): TestableBlock | null {
  // Parse language (first word)
  const parts = meta.split(/\s+/);
  const language = parts[0] || 'typescript';

  // Parse attributes
  const idMatch = meta.match(/id="([^"]+)"/);
  const needsMatch = meta.match(/needs="([^"]+)"/);
  const createsMatch = meta.match(/creates="([^"]+)"/);
  const expectMatch = meta.match(/expect="([^"]+)"/);
  const skipMatch = meta.match(/skip="([^"]+)"/);

  // id is required for testable blocks
  const id = idMatch ? idMatch[1] : `${sourceFile}:${lineNumber}`;

  return {
    id,
    sourceFile,
    lineNumber,
    code,
    language,
    needs: needsMatch ? needsMatch[1].split(',').map((s) => s.trim()) : [],
    creates: createsMatch ? createsMatch[1] : undefined,
    expect: expectMatch ? expectMatch[1] : undefined,
    skip: skipMatch ? skipMatch[1] : undefined,
  };
}

/**
 * Check if testable block dependencies are available
 */
export function checkDependencies(
  block: TestableBlock,
  availableDeps: Set<string>
): { available: boolean; missing: string[] } {
  const missing = block.needs.filter((dep) => !availableDeps.has(dep));
  return {
    available: missing.length === 0,
    missing,
  };
}
