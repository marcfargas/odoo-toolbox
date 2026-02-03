"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTestableBlocks = extractTestableBlocks;
exports.extractFromDirectory = extractFromDirectory;
exports.groupBySourceFile = groupBySourceFile;
exports.getSectionName = getSectionName;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Parse attribute string from code fence metadata.
 * Handles quoted values: id="foo" needs="client,introspector"
 */
function parseAttributes(attrString) {
    const result = {};
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
function extractTestableBlocks(markdownContent, sourceFile, options = {}) {
    const blocks = [];
    // Handle both Windows (CRLF) and Unix (LF) line endings
    const lines = markdownContent.split(/\r?\n/);
    // State machine for parsing
    let inCodeBlock = false;
    let currentBlock = null;
    let codeLines = [];
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
                    console.warn(`Warning: testable block at ${sourceFile}:${lineNumber} missing required 'id' attribute`);
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
        }
        else {
            // Inside code block - look for closing fence
            if (line.match(/^```\s*$/)) {
                // End of code block
                if (currentBlock) {
                    currentBlock.code = codeLines.join('\n');
                    // Apply filters
                    let include = true;
                    if (options.filterIds && options.filterIds.length > 0) {
                        include = include && options.filterIds.includes(currentBlock.id);
                    }
                    if (options.filterNeeds && options.filterNeeds.length > 0) {
                        include = include && options.filterNeeds.some((n) => currentBlock.needs.includes(n));
                    }
                    if (!options.includeSkipped && currentBlock.skip) {
                        include = false;
                    }
                    if (include) {
                        blocks.push(currentBlock);
                    }
                }
                inCodeBlock = false;
                currentBlock = null;
                codeLines = [];
            }
            else {
                // Accumulate code lines
                codeLines.push(line);
            }
        }
    }
    // Handle unclosed code block
    if (inCodeBlock && currentBlock) {
        console.warn(`Warning: unclosed code block starting at ${sourceFile}:${blockStartLine}`);
    }
    return blocks;
}
/**
 * Recursively find all markdown files in a directory.
 */
async function findMarkdownFiles(dirPath) {
    const files = [];
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
        }
        else if (entry.isFile() && entry.name.endsWith('.md')) {
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
async function extractFromDirectory(dirPath, options = {}) {
    const allBlocks = [];
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
function groupBySourceFile(blocks) {
    const grouped = new Map();
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
function getSectionName(sourceFile) {
    return sourceFile.replace(/\.md$/, '');
}
//# sourceMappingURL=markdown-example-extractor.js.map