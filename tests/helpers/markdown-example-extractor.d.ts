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
 * Extract testable code blocks from markdown content.
 *
 * @param markdownContent - Raw markdown content
 * @param sourceFile - Path to source file (for error messages)
 * @param options - Extraction options
 * @returns Array of testable code blocks
 */
export declare function extractTestableBlocks(markdownContent: string, sourceFile: string, options?: ExtractorOptions): TestableCodeBlock[];
/**
 * Extract testable code blocks from all markdown files in a directory.
 *
 * @param dirPath - Directory to scan for markdown files
 * @param options - Extraction options
 * @returns Array of all testable code blocks found
 */
export declare function extractFromDirectory(dirPath: string, options?: ExtractorOptions): Promise<TestableCodeBlock[]>;
/**
 * Group extracted blocks by their source file.
 *
 * @param blocks - Array of testable code blocks
 * @returns Map of source file to blocks
 */
export declare function groupBySourceFile(blocks: TestableCodeBlock[]): Map<string, TestableCodeBlock[]>;
/**
 * Get a human-readable section name from a source file path.
 * E.g., "01-fundamentals/connection.md" -> "01-fundamentals/connection"
 */
export declare function getSectionName(sourceFile: string): string;
//# sourceMappingURL=markdown-example-extractor.d.ts.map