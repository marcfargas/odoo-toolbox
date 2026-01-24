/**
 * File system adapters for both Node.js and browser environments.
 * 
 * This module provides unified file system interfaces that work across
 * different environments, allowing the code generator to be truly universal.
 */

import type { FileSystemAdapter } from './generator.js';

/**
 * Browser File System Access API types.
 * These are declared here to avoid requiring DOM types globally.
 */
interface FileSystemDirectoryHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream {
  write(data: string | ArrayBuffer | ArrayBufferView): Promise<void>;
  close(): Promise<void>;
}

/**
 * Node.js file system adapter using native fs/promises.
 * Only available in Node.js environments.
 */
export async function createNodeFsAdapter(): Promise<FileSystemAdapter> {
  // Dynamic import to avoid bundling in browser builds
  const fs = await import('fs/promises');
  
  return {
    async writeFile(path: string, content: string): Promise<void> {
      await fs.writeFile(path, content, 'utf-8');
    },
    
    async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
      await fs.mkdir(path, options);
    }
  };
}

/**
 * Browser file system adapter using File System Access API.
 * 
 * Requires user permission and only works in secure contexts (HTTPS).
 * Supported in Chrome 86+, Edge 86+, Opera 72+.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */
export function createBrowserFsAdapter(dirHandle: FileSystemDirectoryHandle): FileSystemAdapter {
  return {
    async writeFile(path: string, content: string): Promise<void> {
      // Navigate to the correct directory and create file
      const pathParts = path.split('/').filter(p => p);
      const fileName = pathParts.pop()!;
      
      let currentDir = dirHandle;
      for (const part of pathParts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
      
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    },
    
    async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
      if (!options?.recursive) {
        await dirHandle.getDirectoryHandle(path, { create: true });
        return;
      }
      
      // Create nested directories
      const pathParts = path.split('/').filter(p => p);
      let currentDir = dirHandle;
      for (const part of pathParts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
    }
  };
}

/**
 * In-memory file system adapter for testing or temporary storage.
 * Works in all environments (Node.js and browsers).
 */
export function createMemoryFsAdapter(): FileSystemAdapter & { files: Map<string, string> } {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  
  return {
    files,
    
    async writeFile(path: string, content: string): Promise<void> {
      // Normalize path
      const normalizedPath = path.replace(/\\/g, '/');
      files.set(normalizedPath, content);
    },
    
    async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
      const normalizedPath = path.replace(/\\/g, '/');
      
      if (options?.recursive) {
        // Create all parent directories
        const parts = normalizedPath.split('/').filter(p => p);
        let currentPath = '';
        for (const part of parts) {
          currentPath += (currentPath ? '/' : '') + part;
          dirs.add(currentPath);
        }
      } else {
        dirs.add(normalizedPath);
      }
    }
  };
}
