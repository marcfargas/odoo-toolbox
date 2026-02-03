/**
 * Reference checker - ensures all files are referenced in SKILL.md
 */

export interface ReferenceResult {
  referenced: string[];
  unreferenced: string[];
}

/**
 * Check which files are referenced in SKILL.md
 *
 * @param skillMdContent Content of SKILL.md
 * @param allFiles List of all markdown files (e.g., ['base/connection.md', 'skills/create-lead.md'])
 */
export function checkReferences(skillMdContent: string, allFiles: string[]): ReferenceResult {
  const referenced: string[] = [];
  const unreferenced: string[] = [];

  for (const file of allFiles) {
    // Check various reference patterns:
    // - `base/connection.md`
    // - base/connection.md (without backticks)
    // - connection (just the name without path/extension)
    const filename = file.split('/').pop() || '';
    const basename = filename.replace('.md', '');

    const patterns = [
      file, // Full path: base/connection.md
      filename, // Just filename: connection.md
      basename, // Just name: connection
      `\`${file}\``, // Backticked full path
      `\`${filename}\``, // Backticked filename
    ];

    const isReferenced = patterns.some((pattern) => skillMdContent.includes(pattern));

    if (isReferenced) {
      referenced.push(file);
    } else {
      unreferenced.push(file);
    }
  }

  return { referenced, unreferenced };
}

/**
 * Extract all file references from SKILL.md content
 */
export function extractReferences(skillMdContent: string): string[] {
  const references: string[] = [];

  // Match patterns like `base/something.md` or `skills/something.md`
  const backtickPattern = /`((?:base|skills)\/[^`]+\.md)`/g;
  let match;
  while ((match = backtickPattern.exec(skillMdContent)) !== null) {
    references.push(match[1]);
  }

  // Match patterns in links [text](base/something.md)
  const linkPattern = /\]\(((?:base|skills)\/[^)]+\.md)\)/g;
  while ((match = linkPattern.exec(skillMdContent)) !== null) {
    references.push(match[1]);
  }

  // Deduplicate
  return [...new Set(references)];
}
