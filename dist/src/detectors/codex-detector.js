"use strict";
/**
 * Codex CLI Detector - detects Codex CLI installation and components
 * Scans for Codex executables and config files
 * @module detectors/codex-detector
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
exports.CodexDetector = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const path_utils_1 = require("../utils/path-utils");
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
class CodexDetector {
    constructor() {
        this.name = 'codex-detector';
    }
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
    getPaths() {
        return [
            (0, path_utils_1.expandTilde)('~/.codex/'),
            (0, path_utils_1.expandTilde)('~/.config/codex/')
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
    async checkPATH() {
        const components = [];
        const pathDirs = (0, path_utils_1.parsePATH)();
        const foundExecutables = new Set();
        for (const dir of pathDirs) {
            try {
                // Get all files in the directory
                const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
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
                            await fs_1.promises.access(fullPath, fs_1.promises.constants.X_OK);
                        }
                        catch {
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
                        if (await (0, path_utils_1.isSymlink)(fullPath)) {
                            try {
                                resolvedPath = await (0, path_utils_1.resolvePath)(fullPath);
                            }
                            catch {
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
            }
            catch (error) {
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
    async detect() {
        const components = {};
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
    async extractVersion(executablePath) {
        try {
            const { execFile } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
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
                }
                catch {
                    // This flag didn't work, try the next one
                    continue;
                }
            }
            return null;
        }
        catch (error) {
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
    async detectConfigFiles(dirPath) {
        const components = [];
        const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini'];
        const configNames = ['config', '.codexrc'];
        try {
            const entries = await fs_1.promises.readdir(dirPath, { withFileTypes: true });
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
                const isConfigName = configNames.some(name => entry.name === name || entry.name.startsWith(name));
                if (isConfigExtension || isConfigName) {
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
exports.CodexDetector = CodexDetector;
