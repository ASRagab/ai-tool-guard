/**
 * Gemini Detector - detects Google AI Studio/Gemini Code Assist integrations
 * Scans for Gemini extensions and configuration in VS Code and Cursor directories
 * @module detectors/gemini-detector
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { expandTilde } from '../utils/path-utils.js';
import { readExtensionMetadata } from '../utils/detector-utils.js';
/**
 * Detector for Google Gemini Code Assist extensions in VS Code and Cursor.
 * Searches for:
 * - Gemini Code Assist extensions in ~/.vscode/extensions/
 * - Gemini Code Assist extensions in ~/.cursor/extensions/
 * - Gemini configuration in ~/.config/Code/User/settings.json
 * - Cloud Code extensions (includes Gemini Code Assist)
 *
 * @class GeminiDetector
 * @implements {AIToolDetector}
 *
 * @example
 * ```typescript
 * const detector = new GeminiDetector();
 * const result = await detector.detect();
 *
 * if (result.found) {
 *   console.log('Google Gemini integration detected');
 *   Object.entries(result.components).forEach(([name, info]) => {
 *     console.log(`  ${name}: ${info.path} (${info.type})`);
 *   });
 * }
 * ```
 */
export class GeminiDetector {
    constructor() {
        this.name = 'gemini-detector';
    }
    /**
     * Returns the list of directories to scan for Gemini extensions.
     * Includes VS Code and Cursor extension directories.
     *
     * @returns {string[]} Array of paths to scan:
     *   - ~/.vscode/extensions/ (VS Code extensions)
     *   - ~/.cursor/extensions/ (Cursor extensions)
     *
     * @example
     * ```typescript
     * const detector = new GeminiDetector();
     * const paths = detector.getPaths();
     * // Returns: ['/Users/username/.vscode/extensions', '/Users/username/.cursor/extensions']
     * ```
     */
    getPaths() {
        return [
            expandTilde('~/.vscode/extensions/'),
            expandTilde('~/.cursor/extensions/')
        ];
    }
    /**
     * Not applicable for Gemini detector as Gemini is an extension, not a CLI tool.
     * Returns empty array.
     *
     * @returns {Promise<ComponentInfo[]>} Empty array
     */
    async checkPATH() {
        return [];
    }
    /**
     * Performs a comprehensive detection scan for Google Gemini Code Assist extensions.
     * Detects:
     * - Gemini Code Assist extensions in ~/.vscode/extensions/
     * - Gemini Code Assist extensions in ~/.cursor/extensions/
     * - Cloud Code extensions (which include Gemini Code Assist)
     * - Gemini CLI Companion extensions
     * - Gemini configuration in ~/.config/Code/User/settings.json
     *
     * @returns {Promise<DetectionResult>} Detection results with all found components
     *
     * @example
     * ```typescript
     * const detector = new GeminiDetector();
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
        // Detect Gemini extensions in both VS Code and Cursor
        for (const extensionsPath of scanPaths) {
            const extensions = await this.detectGeminiExtensions(extensionsPath);
            extensions.forEach(comp => {
                const editorType = extensionsPath.includes('.vscode') ? 'vscode' : 'cursor';
                components[`extension:${editorType}:${comp.name}`] = comp;
            });
        }
        // Parse VS Code settings.json for Gemini configuration
        const settingsPath = expandTilde('~/.config/Code/User/settings.json');
        const configComponents = await this.detectGeminiConfig(settingsPath);
        configComponents.forEach(comp => {
            components[`config:${comp.name}`] = comp;
        });
        return {
            ecosystem: 'google-gemini',
            found: Object.keys(components).length > 0,
            components,
            scanPaths: [...scanPaths, settingsPath]
        };
    }
    /**
     * Detects Google Gemini extensions in an extensions directory.
     * Looks for directories matching Gemini-related patterns:
     * - google.geminicodeassist-* (Gemini Code Assist)
     * - google.cloudcode-* (Cloud Code which includes Gemini)
     * - google.gemini-cli-vscode-ide-companion-* (Gemini CLI Companion)
     *
     * @private
     * @param {string} extensionsPath - Path to the extensions directory
     * @returns {Promise<ComponentInfo[]>} Array of detected Gemini extensions
     *
     * @example
     * Given ~/.vscode/extensions/ with:
     * - google.geminicodeassist-1.2.3/
     * - google.cloudcode-2.0.0/
     *
     * Returns:
     * ```typescript
     * [
     *   {
     *     name: 'google.geminicodeassist@1.2.3',
     *     path: '/Users/username/.vscode/extensions/google.geminicodeassist-1.2.3',
     *     type: 'extension'
     *   },
     *   {
     *     name: 'google.cloudcode@2.0.0',
     *     path: '/Users/username/.vscode/extensions/google.cloudcode-2.0.0',
     *     type: 'extension'
     *   }
     * ]
     * ```
     */
    async detectGeminiExtensions(extensionsPath) {
        const components = [];
        try {
            const entries = await fs.readdir(extensionsPath, { withFileTypes: true });
            for (const entry of entries) {
                // Only check directories
                if (!entry.isDirectory()) {
                    continue;
                }
                // Check if directory name matches Gemini-related extension patterns
                const isGeminiExtension = entry.name.startsWith('google.geminicodeassist-') ||
                    entry.name.startsWith('google.cloudcode-') ||
                    entry.name.startsWith('google.gemini-cli-vscode-ide-companion-');
                if (!isGeminiExtension) {
                    continue;
                }
                const fullPath = path.join(extensionsPath, entry.name);
                // Extract extension name and version from directory name
                // Format: google.geminicodeassist-1.2.3 or google.cloudcode-2.0.0
                const match = entry.name.match(/^(google\.[a-z-]+)-(.+)$/);
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
        }
        catch (error) {
            // Directory doesn't exist or isn't accessible - return empty array
            return [];
        }
        return components;
    }
    // readExtensionMetadata is now imported from utils/detector-utils.ts
    /**
     * Parses VS Code settings.json to extract Gemini configuration.
     * Looks for Gemini-related settings like geminicodeassist.*.
     *
     * @private
     * @param {string} settingsPath - Path to settings.json file
     * @returns {Promise<ComponentInfo[]>} Array of detected Gemini configuration entries
     *
     * @example
     * Given settings.json:
     * ```json
     * {
     *   "geminicodeassist.inlineSuggestions.enableAuto": true,
     *   "geminicodeassist.recitation.maxCitedLength": 100,
     *   "cloudcode.gemini.enabled": true
     * }
     * ```
     *
     * Returns:
     * ```typescript
     * [
     *   {
     *     name: 'geminicodeassist.inlineSuggestions.enableAuto',
     *     path: '/Users/username/.config/Code/User/settings.json',
     *     type: 'config-setting'
     *   },
     *   {
     *     name: 'geminicodeassist.recitation.maxCitedLength',
     *     path: '/Users/username/.config/Code/User/settings.json',
     *     type: 'config-setting'
     *   },
     *   {
     *     name: 'cloudcode.gemini.enabled',
     *     path: '/Users/username/.config/Code/User/settings.json',
     *     type: 'config-setting'
     *   }
     * ]
     * ```
     */
    async detectGeminiConfig(settingsPath) {
        const components = [];
        try {
            const content = await fs.readFile(settingsPath, 'utf-8');
            const settings = JSON.parse(content);
            // Look for Gemini-related settings (settings starting with 'geminicodeassist' or 'cloudcode.gemini')
            for (const [key] of Object.entries(settings)) {
                if (key.startsWith('geminicodeassist') || key.startsWith('cloudcode.gemini')) {
                    components.push({
                        name: key,
                        path: settingsPath,
                        type: 'config-setting'
                    });
                }
            }
        }
        catch (error) {
            // File doesn't exist or invalid JSON - return empty array
            return [];
        }
        return components;
    }
}
