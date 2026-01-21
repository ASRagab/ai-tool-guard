/**
 * GitHub Copilot Detector - detects GitHub Copilot extensions in VS Code and Cursor
 * Scans for Copilot extensions and configuration in VS Code and Cursor directories
 * @module detectors/copilot-detector
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AIToolDetector, ComponentInfo, DetectionResult } from './base-detector.js';
import { expandTilde } from '../utils/path-utils.js';
import { readExtensionMetadata } from '../utils/detector-utils.js';

/**
 * Detector for GitHub Copilot extensions in VS Code and Cursor.
 * Searches for:
 * - Copilot extensions in ~/.vscode/extensions/
 * - Copilot extensions in ~/.cursor/extensions/
 * - Copilot configuration in ~/.config/Code/User/settings.json
 *
 * @class CopilotDetector
 * @implements {AIToolDetector}
 *
 * @example
 * ```typescript
 * const detector = new CopilotDetector();
 * const result = await detector.detect();
 *
 * if (result.found) {
 *   console.log('GitHub Copilot installation detected');
 *   Object.entries(result.components).forEach(([name, info]) => {
 *     console.log(`  ${name}: ${info.path} (${info.type})`);
 *   });
 * }
 * ```
 */
export class CopilotDetector implements AIToolDetector {
  readonly name = 'copilot-detector';

  /**
   * Returns the list of directories to scan for Copilot extensions.
   * Includes VS Code and Cursor extension directories.
   *
   * @returns {string[]} Array of paths to scan:
   *   - ~/.vscode/extensions/ (VS Code extensions)
   *   - ~/.cursor/extensions/ (Cursor extensions)
   *
   * @example
   * ```typescript
   * const detector = new CopilotDetector();
   * const paths = detector.getPaths();
   * // Returns: ['/Users/username/.vscode/extensions', '/Users/username/.cursor/extensions']
   * ```
   */
  getPaths(): string[] {
    return [
      expandTilde('~/.vscode/extensions/'),
      expandTilde('~/.cursor/extensions/')
    ];
  }

  /**
   * Not applicable for Copilot detector as Copilot is an extension, not a CLI tool.
   * Returns empty array.
   *
   * @returns {Promise<ComponentInfo[]>} Empty array
   */
  async checkPATH(): Promise<ComponentInfo[]> {
    return [];
  }

  /**
   * Performs a comprehensive detection scan for GitHub Copilot extensions.
   * Detects:
   * - Copilot extensions in ~/.vscode/extensions/
   * - Copilot extensions in ~/.cursor/extensions/
   * - Copilot configuration in ~/.config/Code/User/settings.json
   *
   * @returns {Promise<DetectionResult>} Detection results with all found components
   *
   * @example
   * ```typescript
   * const detector = new CopilotDetector();
   * const result = await detector.detect();
   *
   * if (result.found) {
   *   console.log(`Found ${Object.keys(result.components).length} components`);
   *   console.log(`Scanned paths: ${result.scanPaths.join(', ')}`);
   * }
   * ```
   */
  async detect(): Promise<DetectionResult> {
    const components: Record<string, ComponentInfo> = {};
    const scanPaths = this.getPaths();

    // Detect Copilot extensions in both VS Code and Cursor
    for (const extensionsPath of scanPaths) {
      const extensions = await this.detectCopilotExtensions(extensionsPath);
      extensions.forEach(comp => {
        const editorType = extensionsPath.includes('.vscode') ? 'vscode' : 'cursor';
        components[`extension:${editorType}:${comp.name}`] = comp;
      });
    }

    // Parse VS Code settings.json for Copilot configuration
    const settingsPath = expandTilde('~/.config/Code/User/settings.json');
    const configComponents = await this.detectCopilotConfig(settingsPath);
    configComponents.forEach(comp => {
      components[`config:${comp.name}`] = comp;
    });

    return {
      ecosystem: 'github-copilot',
      found: Object.keys(components).length > 0,
      components,
      scanPaths: [...scanPaths, settingsPath]
    };
  }

  /**
   * Detects GitHub Copilot extensions in an extensions directory.
   * Looks for directories matching 'github.copilot-*' pattern and extracts metadata.
   *
   * @private
   * @param {string} extensionsPath - Path to the extensions directory
   * @returns {Promise<ComponentInfo[]>} Array of detected Copilot extensions
   *
   * @example
   * Given ~/.vscode/extensions/ with:
   * - github.copilot-1.123.0/
   * - github.copilot-chat-0.9.0/
   *
   * Returns:
   * ```typescript
   * [
   *   {
   *     name: 'github.copilot',
   *     path: '/Users/username/.vscode/extensions/github.copilot-1.123.0',
   *     type: 'extension',
   *     version: '1.123.0'
   *   },
   *   {
   *     name: 'github.copilot-chat',
   *     path: '/Users/username/.vscode/extensions/github.copilot-chat-0.9.0',
   *     type: 'extension',
   *     version: '0.9.0'
   *   }
   * ]
   * ```
   */
  private async detectCopilotExtensions(extensionsPath: string): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];

    try {
      const entries = await fs.readdir(extensionsPath, { withFileTypes: true });

      for (const entry of entries) {
        // Only check directories
        if (!entry.isDirectory()) {
          continue;
        }

        // Check if directory name starts with 'github.copilot-'
        if (!entry.name.startsWith('github.copilot-')) {
          continue;
        }

        const fullPath = path.join(extensionsPath, entry.name);

        // Extract extension name and version from directory name
        // Format: github.copilot-chat-0.9.0 or github.copilot-1.123.0
        const match = entry.name.match(/^(github\.copilot(?:-[a-z]+)?)-(.+)$/);
        if (!match) {
          continue;
        }

        const [, extensionName, version] = match;

        // Try to read package.json for additional metadata
        const metadata = await readExtensionMetadata(fullPath);

        // Store version in the name if available, or keep original extension name
        const displayName = metadata?.version
          ? `${extensionName}@${metadata.version}`
          : extensionName;

        components.push({
          name: displayName,
          path: fullPath,
          type: 'extension'
        });
      }
    } catch (error) {
      // Directory doesn't exist or isn't accessible - return empty array
      return [];
    }

    return components;
  }

  // readExtensionMetadata is now imported from utils/detector-utils.ts

  /**
   * Parses VS Code settings.json to extract Copilot configuration.
   * Looks for Copilot-related settings like github.copilot.enable.
   *
   * @private
   * @param {string} settingsPath - Path to settings.json file
   * @returns {Promise<ComponentInfo[]>} Array of detected Copilot configuration entries
   *
   * @example
   * Given settings.json:
   * ```json
   * {
   *   "github.copilot.enable": {
   *     "*": true,
   *     "plaintext": false
   *   },
   *   "github.copilot.editor.enableAutoCompletions": true
   * }
   * ```
   *
   * Returns:
   * ```typescript
   * [
   *   {
   *     name: 'github.copilot.enable',
   *     path: '/Users/username/.config/Code/User/settings.json',
   *     type: 'config-setting'
   *   },
   *   {
   *     name: 'github.copilot.editor.enableAutoCompletions',
   *     path: '/Users/username/.config/Code/User/settings.json',
   *     type: 'config-setting'
   *   }
   * ]
   * ```
   */
  private async detectCopilotConfig(settingsPath: string): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];

    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Look for Copilot-related settings (settings starting with 'github.copilot')
      for (const [key] of Object.entries(settings)) {
        if (key.startsWith('github.copilot')) {
          components.push({
            name: key,
            path: settingsPath,
            type: 'config-setting'
          });
        }
      }
    } catch (error) {
      // File doesn't exist or invalid JSON - return empty array
      return [];
    }

    return components;
  }
}
