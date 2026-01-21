/**
 * Shared detector utilities for AI tool detection system.
 * Contains common functions used across multiple detector implementations.
 * @module utils/detector-utils
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AIToolDetector, ComponentInfo } from '../detectors/base-detector.js';

/**
 * Validates that an object implements the AIToolDetector interface.
 * This is the canonical implementation used by all detector loading code.
 *
 * @param {unknown} obj - Object to validate
 * @returns {boolean} True if the object is a valid detector
 *
 * @example
 * ```typescript
 * import { isValidDetector } from '../utils/detector-utils.js';
 *
 * const detector = new MyDetector();
 * if (isValidDetector(detector)) {
 *   detectors.push(detector);
 * }
 * ```
 */
export function isValidDetector(obj: unknown): obj is AIToolDetector {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof (obj as AIToolDetector).name === 'string' &&
    (obj as AIToolDetector).name.length > 0 &&
    typeof (obj as AIToolDetector).detect === 'function' &&
    typeof (obj as AIToolDetector).getPaths === 'function' &&
    typeof (obj as AIToolDetector).checkPATH === 'function'
  );
}

/**
 * Returns a comma-separated list of missing required properties for debugging.
 *
 * @param {unknown} obj - Object to check
 * @returns {string} List of missing properties
 *
 * @example
 * ```typescript
 * const missing = getMissingDetectorProperties(invalidDetector);
 * console.warn(`Missing properties: ${missing}`);
 * ```
 */
export function getMissingDetectorProperties(obj: unknown): string {
  const missing: string[] = [];

  if (!obj || typeof obj !== 'object') {
    return 'not an object';
  }

  const detector = obj as Partial<AIToolDetector>;

  if (typeof detector.name !== 'string' || detector.name.length === 0) {
    missing.push('name (non-empty string)');
  }
  if (typeof detector.detect !== 'function') {
    missing.push('detect (function)');
  }
  if (typeof detector.getPaths !== 'function') {
    missing.push('getPaths (function)');
  }
  if (typeof detector.checkPATH !== 'function') {
    missing.push('checkPATH (function)');
  }

  return missing.join(', ');
}

/**
 * Detects components in a directory by reading all entries.
 * Categorizes entries by the specified type.
 * Used by multiple detectors for common directory scanning.
 *
 * @param {string} dirPath - Directory path to scan
 * @param {string} componentType - Type classification for detected components
 * @returns {Promise<ComponentInfo[]>} Array of detected components
 *
 * @example
 * ```typescript
 * const plugins = await detectDirectory('~/.claude/plugins/', 'plugin');
 * plugins.forEach(comp => {
 *   console.log(`Found ${comp.name} at ${comp.path}`);
 * });
 * ```
 */
export async function detectDirectory(
  dirPath: string,
  componentType: string
): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip hidden files/directories (starting with .)
      if (entry.name.startsWith('.')) {
        continue;
      }

      components.push({
        name: entry.name,
        path: fullPath,
        type: componentType
      });
    }
  } catch {
    // Directory doesn't exist or isn't accessible - return empty array
    return [];
  }

  return components;
}

/**
 * Extension metadata extracted from package.json
 */
export interface ExtensionMetadata {
  version?: string;
  displayName?: string;
  description?: string;
  publisher?: string;
}

/**
 * Reads extension metadata from package.json file.
 * Used by extension-based detectors (Copilot, Gemini) to get version info.
 *
 * @param {string} extensionPath - Path to the extension directory
 * @returns {Promise<ExtensionMetadata | null>} Extension metadata or null if not found
 *
 * @example
 * ```typescript
 * const metadata = await readExtensionMetadata('/path/to/extension');
 * if (metadata?.version) {
 *   console.log(`Extension version: ${metadata.version}`);
 * }
 * ```
 */
export async function readExtensionMetadata(
  extensionPath: string
): Promise<ExtensionMetadata | null> {
  try {
    const packageJsonPath = path.join(extensionPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    return {
      version: packageJson.version,
      displayName: packageJson.displayName,
      description: packageJson.description,
      publisher: packageJson.publisher
    };
  } catch {
    // package.json doesn't exist or invalid JSON
    return null;
  }
}

/**
 * Ecosystem name aliases for normalization.
 * Maps common short names to their canonical forms.
 */
export const ECOSYSTEM_ALIASES: Record<string, string> = {
  'copilot': 'github-copilot',
  'claude': 'claude-code',
  'gemini': 'google-gemini',
  'open-code': 'opencode'
};

/**
 * Normalizes an ecosystem name to match the canonical format.
 * Handles common aliases and variations.
 *
 * @param {string} name - Ecosystem name to normalize
 * @returns {string} Normalized ecosystem name
 *
 * @example
 * ```typescript
 * normalizeEcosystemName('copilot')  // -> 'github-copilot'
 * normalizeEcosystemName('claude')   // -> 'claude-code'
 * normalizeEcosystemName('gemini')   // -> 'google-gemini'
 * ```
 */
export function normalizeEcosystemName(name: string): string {
  const normalized = name.toLowerCase().trim();
  return ECOSYSTEM_ALIASES[normalized] || normalized;
}
