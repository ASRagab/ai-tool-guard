/**
 * Codex CLI Detector - detects Codex CLI installation and components
 * Scans for Codex executables and config files
 * @module detectors/codex-detector
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AIToolDetector, ComponentInfo, DetectionResult } from './base-detector.js';
import { expandTilde, parsePATH, resolvePath, isSymlink } from '../utils/path-utils.js';

/**
 * Detector for Codex CLI and its components.
 * Searches for:
 * - Codex executable and codex-* variants in PATH
 * - Config files in ~/.codex/ and ~/.config/codex/
 *
 * @class CodexDetector
 * @implements {AIToolDetector}
 *
 * @example
 * ```typescript
 * const detector = new CodexDetector();
 * const result = await detector.detect();
 *
 * if (result.found) {
 *   console.log('Codex installation detected');
 *   Object.entries(result.components).forEach(([name, info]) => {
 *     console.log(`  ${name}: ${info.path} (${info.type})`);
 *   });
 * }
 * ```
 */
export class CodexDetector implements AIToolDetector {
  readonly name = 'codex-detector';

  /**
   * Returns the list of directories to scan for Codex components.
   * Includes both the home directory and the config directory.
   *
   * @returns {string[]} Array of paths to scan:
   *   - ~/.codex/ (primary installation)
   *   - ~/.config/codex/ (configuration)
   *
   * @example
   * ```typescript
   * const detector = new CodexDetector();
   * const paths = detector.getPaths();
   * // Returns: ['/Users/username/.codex', '/Users/username/.config/codex']
   * ```
   */
  getPaths(): string[] {
    return [
      expandTilde('~/.codex/'),
      expandTilde('~/.config/codex/')
    ];
  }

  /**
   * Scans the system PATH for codex executables (codex, codex-*).
   * Resolves symlinks to find the actual installation location.
   * Extracts version information when available.
   *
   * @returns {Promise<ComponentInfo[]>} Array of found executables with resolved paths
   *
   * @example
   * ```typescript
   * const detector = new CodexDetector();
   * const pathComponents = await detector.checkPATH();
   * // Returns: [
   * //   { name: 'codex', path: '/usr/local/bin/codex', type: 'executable' },
   * //   { name: 'codex-cli', path: '/usr/local/bin/codex-cli', type: 'executable' }
   * // ]
   * ```
   */
  async checkPATH(): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];
    const pathDirs = parsePATH();
    const foundExecutables = new Set<string>();

    for (const dir of pathDirs) {
      try {
        // Get all files in the directory
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          // Skip directories
          if (entry.isDirectory()) {
            continue;
          }

          // Check if the file name is 'codex' or starts with 'codex-'
          if (entry.name === 'codex' || entry.name.startsWith('codex-')) {
            const fullPath = path.join(dir, entry.name);

            // Check if the file is executable
            try {
              await fs.access(fullPath, fs.constants.X_OK);
            } catch {
              // Not executable, skip
              continue;
            }

            // Avoid duplicates (if the same executable appears in multiple PATH directories)
            if (foundExecutables.has(entry.name)) {
              continue;
            }
            foundExecutables.add(entry.name);

            // Resolve symlinks to get the real path
            let resolvedPath = fullPath;
            if (await isSymlink(fullPath)) {
              try {
                resolvedPath = await resolvePath(fullPath);
              } catch {
                // If symlink resolution fails, use the original path
                resolvedPath = fullPath;
              }
            }

            // Try to extract version information
            const version = await this.extractVersion(resolvedPath);
            const displayName = version ? `${entry.name}@${version}` : entry.name;

            components.push({
              name: displayName,
              path: resolvedPath,
              type: 'executable'
            });
          }
        }
      } catch (error) {
        // Directory doesn't exist or isn't accessible - continue to next directory
        continue;
      }
    }

    return components;
  }

  /**
   * Performs a comprehensive detection scan for Codex CLI installation.
   * Detects:
   * - Codex executables in PATH (codex, codex-*)
   * - Config files in ~/.codex/ and ~/.config/codex/
   *
   * @returns {Promise<DetectionResult>} Detection results with all found components
   *
   * @example
   * ```typescript
   * const detector = new CodexDetector();
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

    // Check for codex executables in PATH
    const pathComponents = await this.checkPATH();
    pathComponents.forEach(comp => {
      components[`executable:${comp.name}`] = comp;
    });

    // Detect config files in both directories
    for (const basePath of scanPaths) {
      const configFiles = await this.detectConfigFiles(basePath);
      configFiles.forEach(comp => {
        components[`config:${comp.name}`] = comp;
      });
    }

    return {
      ecosystem: 'codex',
      found: Object.keys(components).length > 0,
      components,
      scanPaths
    };
  }

  /**
   * Extracts version information from a Codex executable.
   * Attempts to run the executable with --version flag.
   *
   * @private
   * @param {string} executablePath - Path to the executable
   * @returns {Promise<string | null>} Version string or null if not available
   */
  private async extractVersion(executablePath: string): Promise<string | null> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      // Try common version flags
      const versionFlags = ['--version', '-v', 'version'];

      for (const flag of versionFlags) {
        try {
          const { stdout } = await execFileAsync(executablePath, [flag], {
            timeout: 2000, // 2 second timeout
            maxBuffer: 1024 * 1024 // 1MB max output
          });

          // Extract version from output
          // Common patterns: "codex v1.2.3", "codex 1.2.3", "1.2.3"
          const versionMatch = stdout.match(/(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)/);
          if (versionMatch) {
            return versionMatch[1];
          }
        } catch {
          // This flag didn't work, try the next one
          continue;
        }
      }

      return null;
    } catch (error) {
      // Failed to extract version
      return null;
    }
  }

  /**
   * Detects configuration files in the Codex directory.
   * Looks for common config file patterns (*.json, *.yaml, *.yml, *.toml, *.ini, config, .codexrc*).
   *
   * @private
   * @param {string} dirPath - Directory path to scan for config files
   * @returns {Promise<ComponentInfo[]>} Array of detected config files
   */
  private async detectConfigFiles(dirPath: string): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];
    const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini'];
    const configNames = ['config', '.codexrc'];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Only check files, not directories
        if (!entry.isFile()) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const ext = path.extname(entry.name).toLowerCase();
        const baseName = path.basename(entry.name, ext);

        // Check if file matches config patterns
        const isConfigExtension = configExtensions.includes(ext);
        const isConfigName = configNames.some(name =>
          entry.name === name || entry.name.startsWith(name)
        );

        if (isConfigExtension || isConfigName) {
          components.push({
            name: entry.name,
            path: fullPath,
            type: 'config-file'
          });
        }
      }
    } catch (error) {
      // Directory doesn't exist or isn't accessible - return empty array
      return [];
    }

    return components;
  }
}
