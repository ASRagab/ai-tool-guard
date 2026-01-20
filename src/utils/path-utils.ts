import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Unix-like path handling utilities for macOS and Linux.
 * Provides robust path operations with tilde expansion and symlink resolution.
 */

/**
 * Expands tilde (~) to the user's home directory on Unix-like systems.
 *
 * @param filePath - Path potentially containing tilde
 * @returns Expanded absolute path
 *
 * @example
 * expandTilde('~/documents') // Returns '/Users/username/documents' on macOS
 * expandTilde('~/.config')   // Returns '/Users/username/.config' on macOS
 * expandTilde('/absolute')   // Returns '/absolute' (no change)
 */
export function expandTilde(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    const homeDir = os.homedir();
    return filePath === '~'
      ? homeDir
      : path.join(homeDir, filePath.slice(2));
  }
  return filePath;
}

/**
 * Resolves a path and follows symlinks to get the real absolute path.
 * Uses fs.promises.realpath() for proper symlink resolution.
 *
 * @param filePath - Path to resolve (can include tilde)
 * @returns Promise resolving to the real absolute path
 *
 * @example
 * await resolvePath('~/link-to-dir')  // Resolves symlink and returns real path
 * await resolvePath('./relative')      // Resolves to absolute path
 */
export async function resolvePath(filePath: string): Promise<string> {
  const expanded = expandTilde(filePath);
  try {
    return await fs.promises.realpath(expanded);
  } catch (error) {
    // If realpath fails (e.g., path doesn't exist), return the expanded absolute path
    return path.resolve(expanded);
  }
}

/**
 * Synchronous version of resolvePath for cases where async is not possible.
 *
 * @param filePath - Path to resolve (can include tilde)
 * @returns The real absolute path
 */
export function resolvePathSync(filePath: string): string {
  const expanded = expandTilde(filePath);
  try {
    return fs.realpathSync(expanded);
  } catch (error) {
    // If realpath fails, return the expanded absolute path
    return path.resolve(expanded);
  }
}

/**
 * Parses the PATH environment variable using Unix-style colon separator.
 * Handles tilde expansion and filters out empty entries.
 *
 * @returns Array of absolute directory paths from PATH
 *
 * @example
 * parsePATH() // Returns ['/usr/local/bin', '/usr/bin', '/bin', '/Users/user/.local/bin']
 */
export function parsePATH(): string[] {
  const pathEnv = process.env.PATH || '';
  return pathEnv
    .split(':')
    .filter(p => p.length > 0)
    .map(p => expandTilde(p.trim()))
    .map(p => path.resolve(p));
}

/**
 * Safely joins path segments using path.join() for cross-platform compatibility.
 * Also expands tilde in the first segment if present.
 *
 * @param segments - Path segments to join
 * @returns Joined absolute path
 *
 * @example
 * safePath('~', '.config', 'app')      // Returns '/Users/username/.config/app'
 * safePath('/usr', 'local', 'bin')     // Returns '/usr/local/bin'
 */
export function safePath(...segments: string[]): string {
  if (segments.length === 0) {
    return '';
  }

  const [first, ...rest] = segments;
  const expandedFirst = expandTilde(first);
  return path.join(expandedFirst, ...rest);
}

/**
 * Checks if a path is a symlink.
 *
 * @param filePath - Path to check
 * @returns Promise resolving to true if path is a symlink
 */
export async function isSymlink(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.lstat(filePath);
    return stats.isSymbolicLink();
  } catch (error) {
    return false;
  }
}

/**
 * Gets the home directory for the current user on Unix-like systems.
 *
 * @returns The absolute path to the user's home directory
 *
 * @example
 * getHomeDir() // Returns '/Users/username' on macOS or '/home/username' on Linux
 */
export function getHomeDir(): string {
  return os.homedir();
}
