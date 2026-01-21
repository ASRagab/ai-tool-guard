import { promises as fs } from 'fs';
import * as path from 'path';
import { findClosestMatches } from './utils/string-utils.js';
import { isValidDetector, normalizeEcosystemName, ECOSYSTEM_ALIASES } from './utils/detector-utils.js';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Orchestrator class that loads and runs all AI tool detectors in parallel.
 * Handles dynamic detector loading, parallel execution, error recovery, and timeouts.
 *
 * @class AutoDetector
 *
 * @example
 * ```typescript
 * const autoDetector = new AutoDetector();
 * const results = await autoDetector.detectAll();
 *
 * results.forEach((result, ecosystem) => {
 *   console.log(`${ecosystem}: ${result.found ? 'Found' : 'Not found'}`);
 * });
 * ```
 */
export class AutoDetector {
    constructor(detectorsPath) {
        this.detectors = [];
        this.DETECTOR_TIMEOUT_MS = 30000; // 30 seconds
        this.detectorFailures = [];
        this.detectorsDir = detectorsPath || path.join(__dirname, 'detectors');
    }
    /**
     * Dynamically loads all detector modules from the detectors directory.
     * Skips the base-detector.ts file and only loads valid detector implementations.
     *
     * @returns {Promise<void>}
     * @throws {Error} If the detectors directory cannot be accessed
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     * console.log(`Loaded ${autoDetector.getDetectorCount()} detectors`);
     * ```
     */
    async loadDetectors() {
        try {
            const files = await fs.readdir(this.detectorsDir);
            const detectorFiles = files.filter(file => (file.endsWith('.ts') || file.endsWith('.js')) &&
                file !== 'base-detector.ts' &&
                file !== 'base-detector.js' &&
                file !== 'detector-registry.ts' &&
                file !== 'detector-registry.js');
            for (const file of detectorFiles) {
                try {
                    const modulePath = path.join(this.detectorsDir, file);
                    const module = await import(modulePath);
                    const DetectorClass = module.default || module[Object.keys(module)[0]];
                    if (DetectorClass) {
                        const detector = typeof DetectorClass === 'function'
                            ? new DetectorClass()
                            : DetectorClass;
                        if (isValidDetector(detector)) {
                            this.detectors.push(detector);
                        }
                    }
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.warn(chalk.yellow(`⚠️  Failed to load detector from ${file}: ${errorMsg}`));
                    this.detectorFailures.push({
                        detectorName: file,
                        error: errorMsg,
                        type: 'load-error'
                    });
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to read detectors directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // isValidDetector is now imported from utils/detector-utils.ts
    /**
     * Runs all loaded detectors in parallel with timeout protection.
     * Returns only the results for ecosystems where components were found.
     *
     * @param {string} [ecosystemFilter] - Optional ecosystem name to filter detection (e.g., 'claude-code', 'copilot')
     * @param {string} [componentTypeFilter] - Optional component type to filter (e.g., 'mcp-server', 'hook', 'skill')
     * @returns {Promise<Map<string, DetectionResult>>} Map of ecosystem names to detection results (only found ecosystems)
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     *
     * // Detect all ecosystems
     * const results = await autoDetector.detectAll();
     *
     * // Detect only Claude Code
     * const claudeResults = await autoDetector.detectAll('claude-code');
     *
     * // Detect only MCP servers across all ecosystems
     * const mcpResults = await autoDetector.detectAll(undefined, 'mcp-server');
     *
     * if (results.size === 0) {
     *   console.log('No AI tools detected');
     * } else {
     *   results.forEach((result, ecosystem) => {
     *     console.log(`${ecosystem}: Found ${Object.keys(result.components).length} components`);
     *   });
     * }
     * ```
     */
    async detectAll(ecosystemFilter, componentTypeFilter) {
        const results = new Map();
        let detectorsToRun = this.detectors;
        if (ecosystemFilter) {
            const availableEcosystems = this.getAvailableEcosystems();
            const normalizedEcosystem = normalizeEcosystemName(ecosystemFilter);
            if (!availableEcosystems.includes(normalizedEcosystem)) {
                // Include short aliases in suggestions
                const aliasKeys = Object.keys(ECOSYSTEM_ALIASES);
                const ecosystemsWithAliases = [...availableEcosystems, ...aliasKeys];
                const suggestions = findClosestMatches(ecosystemFilter, ecosystemsWithAliases, 5 // Increase max distance to catch more typos
                );
                // Map aliases to their full names
                const fullNameSuggestions = suggestions.map(s => ECOSYSTEM_ALIASES[s] || s);
                const uniqueSuggestions = [...new Set(fullNameSuggestions)];
                let errorMsg = `Invalid ecosystem name: "${ecosystemFilter}"`;
                if (uniqueSuggestions.length > 0) {
                    errorMsg += `\n\nDid you mean: ${uniqueSuggestions.join(', ')}?`;
                }
                errorMsg += `\n\nAvailable ecosystems: ${availableEcosystems.join(', ')}`;
                throw new Error(errorMsg);
            }
            detectorsToRun = this.detectors.filter(d => {
                // Match detector name to ecosystem
                const detectorEcosystem = d.name.replace('-detector', '');
                return detectorEcosystem === normalizedEcosystem.replace(/-/g, '') ||
                    detectorEcosystem === normalizedEcosystem.replace('github-', '') ||
                    d.name.includes(normalizedEcosystem.replace(/-/g, ''));
            });
        }
        const detectionPromises = detectorsToRun.map(detector => this.runDetectorWithTimeout(detector));
        const detectionResults = await Promise.all(detectionPromises);
        detectionResults.forEach(result => {
            if (result && result.found) {
                if (componentTypeFilter) {
                    const filteredComponents = this.filterComponentsByType(result.components, componentTypeFilter);
                    if (Object.keys(filteredComponents).length > 0) {
                        results.set(result.ecosystem, {
                            ...result,
                            components: filteredComponents
                        });
                    }
                }
                else {
                    results.set(result.ecosystem, result);
                }
            }
        });
        return results;
    }
    /**
     * Runs a single detector with timeout protection and error handling.
     * Continues with other detectors if one fails, tracking failures for summary.
     *
     * @private
     * @param {AIToolDetector} detector - The detector to run
     * @returns {Promise<DetectionResult | null>} Detection result or null if failed/timed out
     */
    async runDetectorWithTimeout(detector) {
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Detector ${detector.name} timed out after ${this.DETECTOR_TIMEOUT_MS}ms`));
                }, this.DETECTOR_TIMEOUT_MS);
            });
            const result = await Promise.race([
                detector.detect(),
                timeoutPromise
            ]);
            return result;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const isTimeout = errorMsg.includes('timed out');
            console.warn(chalk.yellow(`⚠️  Detector ${detector.name} ${isTimeout ? 'timed out' : 'failed'}: ${errorMsg}`));
            this.detectorFailures.push({
                detectorName: detector.name,
                error: errorMsg,
                type: isTimeout ? 'timeout' : 'error'
            });
            return null;
        }
    }
    /**
     * Gets the number of currently loaded detectors.
     *
     * @returns {number} Count of loaded detectors
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     * console.log(`Loaded ${autoDetector.getDetectorCount()} detectors`);
     * ```
     */
    getDetectorCount() {
        return this.detectors.length;
    }
    /**
     * Gets the names of all loaded detectors.
     *
     * @returns {string[]} Array of detector names
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     * console.log('Loaded detectors:', autoDetector.getDetectorNames().join(', '));
     * ```
     */
    getDetectorNames() {
        return this.detectors.map(d => d.name);
    }
    /**
     * Gets the list of available ecosystem names based on loaded detectors.
     *
     * @returns {string[]} Array of ecosystem names
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     * console.log('Available ecosystems:', autoDetector.getAvailableEcosystems().join(', '));
     * // Output: ['claude-code', 'github-copilot', 'opencode', 'codex', 'google-gemini']
     * ```
     */
    getAvailableEcosystems() {
        const ecosystems = this.detectors.map(d => {
            const name = d.name.replace('-detector', '');
            if (name === 'claudecode' || name === 'claude-code')
                return 'claude-code';
            if (name === 'copilot')
                return 'github-copilot';
            if (name === 'gemini')
                return 'google-gemini';
            return name;
        });
        return [...new Set(ecosystems)];
    }
    // normalizeEcosystemName is now imported from utils/detector-utils.ts
    /**
     * Filters components by type, supporting both exact matches and partial matches.
     *
     * @private
     * @param {Record<string, ComponentInfo>} components - Components to filter
     * @param {string} typeFilter - Component type to filter by (e.g., 'mcp-server', 'hook', 'skill')
     * @returns {Record<string, ComponentInfo>} Filtered components
     *
     * @example
     * // Filter for MCP servers
     * filterComponentsByType(components, 'mcp-server')
     * // Returns only components with type 'mcp-server'
     *
     * // Filter for hooks
     * filterComponentsByType(components, 'hook')
     * // Returns only components with type 'hook'
     */
    filterComponentsByType(components, typeFilter) {
        const filtered = {};
        const normalizedFilter = typeFilter.toLowerCase().trim();
        for (const [key, component] of Object.entries(components)) {
            if (component.type && component.type.toLowerCase().includes(normalizedFilter)) {
                filtered[key] = component;
                continue;
            }
            if (key.toLowerCase().startsWith(normalizedFilter + ':')) {
                filtered[key] = component;
                continue;
            }
            const singularFilter = normalizedFilter.endsWith('s')
                ? normalizedFilter.slice(0, -1)
                : normalizedFilter;
            if (component.type && component.type.toLowerCase().includes(singularFilter)) {
                filtered[key] = component;
                continue;
            }
            if (key.toLowerCase().startsWith(singularFilter + ':')) {
                filtered[key] = component;
            }
        }
        return filtered;
    }
    /**
     * Gets all detector failures encountered during loading and detection.
     *
     * @returns {DetectorFailure[]} Array of detector failures
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     * await autoDetector.detectAll();
     *
     * const failures = autoDetector.getFailures();
     * if (failures.length > 0) {
     *   console.log('Some detectors failed:', failures);
     * }
     * ```
     */
    getFailures() {
        return this.detectorFailures;
    }
    /**
     * Displays a summary of detector failures if any occurred.
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     * await autoDetector.detectAll();
     * autoDetector.displayFailureSummary();
     * ```
     */
    displayFailureSummary() {
        if (this.detectorFailures.length === 0) {
            return;
        }
        console.log(chalk.yellow('\n⚠️  Detector Failures:'));
        const failuresByType = this.detectorFailures.reduce((acc, failure) => {
            acc[failure.type] = (acc[failure.type] || 0) + 1;
            return acc;
        }, {});
        Object.entries(failuresByType).forEach(([type, count]) => {
            console.log(chalk.yellow(`   - ${type}: ${count} detector(s)`));
        });
        console.log(chalk.yellow('\n   Details:'));
        this.detectorFailures.forEach(failure => {
            console.log(chalk.dim(`   - ${failure.detectorName}: ${failure.error}`));
        });
    }
    /**
     * Runs all detectors and returns detailed summary including failures.
     *
     * @param {string} [ecosystemFilter] - Optional ecosystem name to filter detection
     * @param {string} [componentTypeFilter] - Optional component type to filter
     * @returns {Promise<DetectionSummary>} Detection results with failure tracking
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     * const summary = await autoDetector.detectAllWithSummary();
     *
     * summary.results.forEach((result, ecosystem) => {
     *   console.log(`${ecosystem}: Found`);
     * });
     *
     * if (summary.failures.length > 0) {
     *   console.log('Some detectors failed');
     * }
     * ```
     */
    async detectAllWithSummary(ecosystemFilter, componentTypeFilter) {
        const results = await this.detectAll(ecosystemFilter, componentTypeFilter);
        return {
            results,
            failures: this.detectorFailures
        };
    }
    /**
     * Scans all detected components using appropriate scanners based on component type.
     * For each ecosystem and its components, selects the appropriate scanner and performs security scanning.
     *
     * @param {Map<string, DetectionResult>} detectionResults - Results from detectAll() containing detected ecosystems and components
     * @returns {Promise<ScanReport>} Complete scan report with results for all ecosystems
     *
     * @example
     * ```typescript
     * const autoDetector = new AutoDetector();
     * await autoDetector.loadDetectors();
     * const detectionResults = await autoDetector.detectAll();
     * const scanReport = await autoDetector.scanDetected(detectionResults);
     *
     * scanReport.ecosystemReports.forEach((report, ecosystem) => {
     *   console.log(`${ecosystem}: ${report.totalIssues} issues found`);
     * });
     * ```
     */
    async scanDetected(detectionResults) {
        const { selectScanner } = await import('./scanners/scanner-factory.js');
        const ecosystemReports = new Map();
        let totalIssues = 0;
        for (const [ecosystemName, detectionResult] of detectionResults) {
            const componentScans = new Map();
            let ecosystemTotalIssues = 0;
            for (const [componentKey, componentInfo] of Object.entries(detectionResult.components)) {
                try {
                    const componentType = this.mapComponentTypeToScannerType(componentInfo.type);
                    const scanner = selectScanner(componentType, componentInfo.path);
                    const scanResults = await scanner.scanDirectory(componentInfo.path);
                    if (scanResults.length > 0) {
                        componentScans.set(componentKey, scanResults);
                        const componentIssues = scanResults.reduce((sum, result) => sum + result.matches.length, 0);
                        ecosystemTotalIssues += componentIssues;
                    }
                }
                catch (error) {
                    console.warn(chalk.yellow(`⚠️  Failed to scan component ${componentKey}: ${error instanceof Error ? error.message : String(error)}`));
                }
            }
            // Create ecosystem report
            const ecosystemReport = {
                ecosystem: ecosystemName,
                componentScans,
                totalIssues: ecosystemTotalIssues
            };
            ecosystemReports.set(ecosystemName, ecosystemReport);
            totalIssues += ecosystemTotalIssues;
        }
        // Create and return the complete scan report
        return {
            ecosystemReports,
            totalIssues,
            timestamp: new Date()
        };
    }
    /**
     * Maps component type string to scanner-factory ComponentType.
     *
     * @private
     * @param {string} [type] - Component type string from detection (e.g., 'mcp-server', 'hook', 'skill')
     * @returns {'mcpServer' | 'hook' | 'skill' | 'config' | 'unknown'} Normalized component type for scanner selection
     */
    mapComponentTypeToScannerType(type) {
        if (!type) {
            return 'unknown';
        }
        const normalizedType = type.toLowerCase().trim();
        // Map various type strings to scanner types
        if (normalizedType.includes('mcp')) {
            return 'mcpServer';
        }
        if (normalizedType.includes('hook')) {
            return 'hook';
        }
        if (normalizedType.includes('skill') || normalizedType.includes('agent')) {
            return 'skill';
        }
        if (normalizedType.includes('config')) {
            return 'config';
        }
        return 'unknown';
    }
}
