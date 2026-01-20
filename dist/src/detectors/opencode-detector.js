"use strict";
/**
 * OpenCode Detector - detects OpenCode installation and components
 * Scans for plugins and config files in OpenCode directories
 * @module detectors/opencode-detector
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
exports.OpenCodeDetector = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const path_utils_1 = require("../utils/path-utils");
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
class OpenCodeDetector {
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
            (0, path_utils_1.expandTilde)('~/.config/opencode/'),
            (0, path_utils_1.expandTilde)('~/.opencode/')
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
        const pathDirs = (0, path_utils_1.parsePATH)();
        for (const dir of pathDirs) {
            try {
                const opencodePath = path.join(dir, 'opencode');
                // Check if the executable exists
                try {
                    await fs_1.promises.access(opencodePath, fs_1.promises.constants.X_OK);
                }
                catch {
                    // Not executable or doesn't exist, skip
                    continue;
                }
                // Resolve symlinks to get the real path
                let resolvedPath = opencodePath;
                if (await (0, path_utils_1.isSymlink)(opencodePath)) {
                    try {
                        resolvedPath = await (0, path_utils_1.resolvePath)(opencodePath);
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
            const plugins = await this.detectDirectory(pluginsPath, 'plugin');
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
    /**
     * Detects components in a directory by reading all entries.
     * Categorizes entries by the specified type.
     *
     * @private
     * @param {string} dirPath - Directory path to scan
     * @param {string} componentType - Type classification for detected components
     * @returns {Promise<ComponentInfo[]>} Array of detected components
     */
    async detectDirectory(dirPath, componentType) {
        const components = [];
        try {
            const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
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
        }
        catch (error) {
            // Directory doesn't exist or isn't accessible - return empty array
            return [];
        }
        return components;
    }
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
            const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
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
exports.OpenCodeDetector = OpenCodeDetector;
