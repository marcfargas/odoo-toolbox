/**
 * Markdown Example Extractor
 *
 * Parses markdown files and extracts testable code blocks marked with
 * the `testable` annotation in code fence metadata.
 *
 * Example markdown:
 * ```typescript testable id="basic-connection" needs="client" expect="session !== null"
 * const session = client.getSession();
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TestableCodeBlock {
  /** Unique identifier for the test */
  id: string;
  /** Source file path */
  sourceFile: string;
  /** Line number in source file (1-indexed) */
  lineNumber: number;
  /** The raw code content */
  code: string;
  /** Dependencies this code needs (e.g., 'client', 'introspector') */
  needs: string[];
  /** Model name if this code creates records (for cleanup) */
  creates?: string;
  /** Simple assertion expression */
  expect?: string;
  /** Skip reason if any */
  skip?: string;
  /** Custom timeout in milliseconds */
  timeout?: number;
  /** Language (typescript, javascript) */
  language: string;
}

export interface ExtractorOptions {
  /** Only extract blocks with these IDs */
  filterIds?: string[];
  /** Only extract blocks with these dependencies */
  filterNeeds?: string[];
  /** Include blocks marked as skip */
  includeSkipped?: boolean;
}

/**
 * Parse attribute string from code fence metadata.
 * Handles quoted values: id="foo" needs="client,introspector"
 */
function parseAttributes(attrString: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Match key="value" or key='value' patterns
  const attrPattern = /(\w+)=["']([^"']*)["']/g;
  let match;
  while ((match = attrPattern.exec(attrString)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

/**
 * Extract testable code blocks from markdown content.
 *
 * @param markdownContent - Raw markdown content
 * @param sourceFile - Path to source file (for error messages)
 * @param options - Extraction options
 * @returns Array of testable code blocks
 */
export function extractTestableBlocks(
  markdownContent: string,
  sourceFile: string,
  options: ExtractorOptions = {}
): TestableCodeBlock[] {
  const blocks: TestableCodeBlock[] = [];
  // Handle both Windows (CRLF) and Unix (LF) line endings
  const lines = markdownContent.split(/\r?\n/);

  // State machine for parsing
  let inCodeBlock = false;
  let currentBlock: Partial<TestableCodeBlock> | null = null;
  let codeLines: string[] = [];
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd(); // Remove trailing whitespace/CR
    const lineNumber = i + 1; // 1-indexed

    if (!inCodeBlock) {
      // Look for opening code fence with testable marker
      // Pattern: ```typescript testable id="..." ...
      const openMatch = line.match(/^```(\w+)\s+testable\s+(.*)$/);
      if (openMatch) {
        const language = openMatch[1];
        const attrsString = openMatch[2];
        const attrs = parseAttributes(attrsString);

        if (!attrs.id) {
          console.warn(
            `Warning: testable block at ${sourceFile}:${lineNumber} missing required 'id' attribute`
          );
          continue;
        }

        inCodeBlock = true;
        blockStartLine = lineNumber;
        codeLines = [];

        currentBlock = {
          id: attrs.id,
          sourceFile,
          lineNumber,
          language,
          needs: attrs.needs ? attrs.needs.split(',').map((n) => n.trim()) : [],
          creates: attrs.creates,
          expect: attrs.expect,
          skip: attrs.skip,
          timeout: attrs.timeout ? parseInt(attrs.timeout, 10) : undefined,
        };
      }
    } else {
      // Inside code block - look for closing fence
      if (line.match(/^```\s*$/)) {
        // End of code block
        if (currentBlock) {
          currentBlock.code = codeLines.join('\n');

          // Apply filters
          let include = true;

          if (options.filterIds && options.filterIds.length > 0) {
            include = include && options.filterIds.includes(currentBlock.id!);
          }

          if (options.filterNeeds && options.filterNeeds.length > 0) {
            include =
              include &&
              options.filterNeeds.some((n) => currentBlock!.needs!.includes(n));
          }

          if (!options.includeSkipped && currentBlock.skip) {
            include = false;
          }

          if (include) {
            blocks.push(currentBlock as TestableCodeBlock);
          }
        }

        inCodeBlock = false;
        currentBlock = null;
        codeLines = [];
      } else {
        // Accumulate code lines
        codeLines.push(line);
      }
    }
  }

  // Handle unclosed code block
  if (inCodeBlock && currentBlock) {
    console.warn(
      `Warning: unclosed code block starting at ${sourceFile}:${blockStartLine}`
    );
  }

  return blocks;
}

/**
 * Recursively find all markdown files in a directory.
 */
async function findMarkdownFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip __tests__ and node_modules
      if (entry.name === '__tests__' || entry.name === 'node_modules') {
        continue;
      }
      const subFiles = await findMarkdownFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract testable code blocks from all markdown files in a directory.
 *
 * @param dirPath - Directory to scan for markdown files
 * @param options - Extraction options
 * @returns Array of all testable code blocks found
 */
export async function extractFromDirectory(
  dirPath: string,
  options: ExtractorOptions = {}
): Promise<TestableCodeBlock[]> {
  const allBlocks: TestableCodeBlock[] = [];

  const mdFiles = await findMarkdownFiles(dirPath);

  for (const filePath of mdFiles) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const relativePath = path.relative(dirPath, filePath);
    const blocks = extractTestableBlocks(content, relativePath, options);
    allBlocks.push(...blocks);
  }

  return allBlocks;
}

/**
 * Group extracted blocks by their source file.
 *
 * @param blocks - Array of testable code blocks
 * @returns Map of source file to blocks
 */
export function groupBySourceFile(
  blocks: TestableCodeBlock[]
): Map<string, TestableCodeBlock[]> {
  const grouped = new Map<string, TestableCodeBlock[]>();

  for (const block of blocks) {
    const existing = grouped.get(block.sourceFile) || [];
    existing.push(block);
    grouped.set(block.sourceFile, existing);
  }

  return grouped;
}

/**
 * Get a human-readable section name from a source file path.
 * E.g., "01-fundamentals/connection.md" -> "01-fundamentals/connection"
 */
export function getSectionName(sourceFile: string): string {
  return sourceFile.replace(/\.md$/, '');
}
