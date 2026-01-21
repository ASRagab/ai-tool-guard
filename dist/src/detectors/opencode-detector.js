/**
 * OpenCode Detector - detects OpenCode installation and components
 * Scans for plugins and config files in OpenCode directories
 * @module detectors/opencode-detector
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { expandTilde, parsePATH, resolvePath, isSymlink } from '../utils/path-utils.js';
import { detectDirectory } from '../utils/detector-utils.js';
/**
 * Detector for OpenCode CLI and its components.
 * Searches for:
 * - OpenCode executable in PATH
 * - Plugins in ~/.config/opencode/ and ~/.opencode/
 * - Config files in ~/.config/opencode/ and ~/.opencode/
 *
 * @class OpenCodeDetector
 * @implements {AIToolDetector}
 *
 * @example
 * ```typescript
 * const detector = new OpenCodeDetector();
 * const result = await detector.detect();
 *
 * if (result.found) {
 *   console.log('OpenCode installation detected');
 *   Object.entries(result.components).forEach(([name, info]) => {
 *     console.log(`  ${name}: ${info.path} (${info.type})`);
 *   });
 * }
 * ```
 */
export class OpenCodeDetector {
    constructor() {
        this.name = 'opencode-detector';
    }
    /**
     * Returns the list of directories to scan for OpenCode components.
     * Includes both the config directory and the legacy home directory.
     *
     * @returns {string[]} Array of paths to scan:
     *   - ~/.config/opencode/ (config directory)
     *   - ~/.opencode/ (legacy home directory)
     *
     * @example
     * ```typescript
     * const detector = new OpenCodeDetector();
     * const paths = detector.getPaths();
     * // Returns: ['/Users/username/.config/opencode', '/Users/username/.opencode']
     * ```
     */
    getPaths() {
        return [
            expandTilde('~/.config/opencode/'),
            expandTilde('~/.opencode/')
        ];
    }
    /**
     * Scans the system PATH for the opencode executable.
     * Resolves symlinks to find the actual installation location.
     *
     * @returns {Promise<ComponentInfo[]>} Array of found executables with resolved paths
     *
     * @example
     * ```typescript
     * const detector = new OpenCodeDetector();
     * const pathComponents = await detector.checkPATH();
     * // Returns: [{ name: 'opencode', path: '/usr/local/bin/opencode', type: 'executable' }]
     * ```
     */
    async checkPATH() {
        const components = [];
        const pathDirs = parsePATH();
        for (const dir of pathDirs) {
            try {
                const opencodePath = path.join(dir, 'opencode');
                // Check if the executable exists
                try {
                    await fs.access(opencodePath, fs.constants.X_OK);
                }
                catch {
                    // Not executable or doesn't exist, skip
                    continue;
                }
                // Resolve symlinks to get the real path
                let resolvedPath = opencodePath;
                if (await isSymlink(opencodePath)) {
                    try {
                        resolvedPath = await resolvePath(opencodePath);
                    }
                    catch {
                        // If symlink resolution fails, use the original path
                        resolvedPath = opencodePath;
                    }
                }
                components.push({
                    name: 'opencode',
                    path: resolvedPath,
                    type: 'executable'
                });
                // Found one instance, no need to check other PATH directories
                break;
            }
            catch (error) {
                // Silently continue to next directory
                continue;
            }
        }
        return components;
    }
    /**
     * Performs a comprehensive detection scan for OpenCode installation.
     * Detects:
     * - Plugins in ~/.config/opencode/ and ~/.opencode/
     * - Config files in ~/.config/opencode/ and ~/.opencode/
     * - OpenCode executable in PATH
     *
     * @returns {Promise<DetectionResult>} Detection results with all found components
     *
     * @example
     * ```typescript
     * const detector = new OpenCodeDetector();
     * const result = await detector.detect();
     *
     * if (result.found) {
     *   console.log(`Found ${Object.keys(result.components).length} components`);
     *   console.log(`Scanned paths: ${result.scanPaths.join(', ')}`);
     * }
     * ```
     */
    async detect() {
        const components = {};
        const scanPaths = this.getPaths();
        // Check for opencode executable in PATH
        const pathComponents = await this.checkPATH();
        pathComponents.forEach(comp => {
            components[`executable:${comp.name}`] = comp;
        });
        // Detect plugins and config files in both directories
        for (const basePath of scanPaths) {
            // Detect plugins directory
            const pluginsPath = path.join(basePath, 'plugins');
            const plugins = await detectDirectory(pluginsPath, 'plugin');
            plugins.forEach(comp => {
                components[`plugin:${comp.name}`] = comp;
            });
            // Detect config files in the base directory
            const configFiles = await this.detectConfigFiles(basePath);
            configFiles.forEach(comp => {
                components[`config:${comp.name}`] = comp;
            });
        }
        return {
            ecosystem: 'opencode',
            found: Object.keys(components).length > 0,
            components,
            scanPaths
        };
    }
    // detectDirectory is now imported from utils/detector-utils.ts
    /**
     * Detects configuration files in the OpenCode directory.
     * Looks for common config file patterns (*.json, *.yaml, *.yml, *.toml, *.ini).
     *
     * @private
     * @param {string} dirPath - Directory path to scan for config files
     * @returns {Promise<ComponentInfo[]>} Array of detected config files
     */
    async detectConfigFiles(dirPath) {
        const components = [];
        const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini'];
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                // Only check files, not directories
                if (!entry.isFile()) {
                    continue;
                }
                // Skip hidden files (starting with .)
                if (entry.name.startsWith('.')) {
                    continue;
                }
                // Check if file has a config extension
                const ext = path.extname(entry.name).toLowerCase();
                if (configExtensions.includes(ext)) {
                    const fullPath = path.join(dirPath, entry.name);
                    components.push({
                        name: entry.name,
                        path: fullPath,
                        type: 'config-file'
                    });
                }
            }
        }
        catch (error) {
            // Directory doesn't exist or isn't accessible - return empty array
            return [];
        }
        return components;
    }
}
