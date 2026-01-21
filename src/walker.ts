import { fdir } from 'fdir';
import * as fs from 'fs';
import { expandTilde, resolvePath } from './utils/path-utils.js';

/**
 * Errors encountered during directory walking
 */
export interface WalkError {
  path: string;
  type: 'permission' | 'symlink-loop' | 'other';
  message: string;
}

/**
 * Result from directory walking including files and errors
 */
export interface WalkResult {
  files: string[];
  errors: WalkError[];
}

/**
 * High-performance directory walker using 'fdir' with error handling and safety features.
 *
 * @param dir Root directory to start scanning from (supports tilde expansion)
 * @param extensions List of file extensions to include (e.g., ['.ts', '.py']) or ['*'] for all
 * @returns Promise resolving to an array of absolute file paths
 */
export async function walkDirectory(dir: string, extensions: string[]): Promise<string[]> {
  const result = await walkDirectoryWithErrors(dir, extensions);

  // Log warnings for errors but return files
  result.errors.forEach(error => {
    if (error.type === 'permission') {
      console.warn(`⚠️  Permission denied: ${error.path}`);
    } else if (error.type === 'symlink-loop') {
      console.warn(`⚠️  Symlink loop detected: ${error.path}`);
    } else {
      console.warn(`⚠️  Error accessing: ${error.path} - ${error.message}`);
    }
  });

  return result.files;
}

/**
 * High-performance directory walker with detailed error reporting.
 * Includes symlink loop prevention and permission error handling.
 *
 * @param dir Root directory to start scanning from (supports tilde expansion)
 * @param extensions List of file extensions to include (e.g., ['.ts', '.py']) or ['*'] for all
 * @returns Promise resolving to WalkResult with files and errors
 */
export async function walkDirectoryWithErrors(dir: string, extensions: string[]): Promise<WalkResult> {
  const errors: WalkError[] = [];
  const visitedPaths = new Set<string>();

  // Expand tilde and resolve symlinks in the directory path
  const expandedDir = expandTilde(dir);
  let resolvedDir: string;

  try {
    resolvedDir = await resolvePath(expandedDir);
  } catch (error) {
    errors.push({
      path: expandedDir,
      type: 'permission',
      message: error instanceof Error ? error.message : String(error)
    });
    return { files: [], errors };
  }

  // Check if we can access the directory
  try {
    await fs.promises.access(resolvedDir, fs.constants.R_OK);
  } catch (error) {
    errors.push({
      path: resolvedDir,
      type: 'permission',
      message: 'Directory not readable'
    });
    return { files: [], errors };
  }

  // Track the root path to prevent symlink loops
  visitedPaths.add(resolvedDir);

  // Normalize extensions to not have leading dots for fdir if possible,
  // or handle filtering manually. fdir globbing is powerful.
  // Converting ['.ts', '.py'] -> '**/*.{ts,py}'

  const extList = extensions
    .map(e => e.replace(/^\./, '')) // remove leading dot
    .filter(e => e !== '*');

  let crawler = new fdir()
    .withFullPaths()
    .withMaxDepth(10) // Safety: Prevent infinite recursion/deep loops
    .exclude((dirName, dirPath) => {
      // Exclude common directories
      if (['node_modules', 'dist', 'build', '.git', '.idea', '.vscode'].includes(dirName) || dirName.startsWith('.')) {
        return true;
      }

      // Check for symlink loops by tracking visited paths
      try {
        const stats = fs.lstatSync(dirPath);
        if (stats.isSymbolicLink()) {
          const realPath = fs.realpathSync(dirPath);
          if (visitedPaths.has(realPath)) {
            errors.push({
              path: dirPath,
              type: 'symlink-loop',
              message: 'Symlink loop detected'
            });
            return true;
          }
          visitedPaths.add(realPath);
        }
      } catch (error) {
        // Permission error or other issue - skip this directory
        errors.push({
          path: dirPath,
          type: 'permission',
          message: error instanceof Error ? error.message : String(error)
        });
        return true;
      }

      return false;
    });

  if (extList.length > 0) {
    // Optimization: Use native fdir filtering instead of globbing
    // logic: "Ends with any of the extensions"
    crawler = crawler.filter((filePath) => {
      return extList.some(ext => filePath.endsWith('.' + ext));
    });
  }

  // If extensions contains '*', we don't apply the filter (scan all files)

  let files: string[] = [];
  try {
    files = await crawler.crawl(resolvedDir).withPromise() as string[];
  } catch (error) {
    errors.push({
      path: resolvedDir,
      type: 'other',
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return { files, errors };
}
