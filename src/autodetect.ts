/**
 * AutoDetector orchestrator for running multiple AI tool detectors in parallel.
 * Provides automatic loading and execution of all available detectors.
 * @module autodetect
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AIToolDetector, DetectionResult, ComponentInfo } from './detectors/base-detector';
import { findClosestMatches } from './utils/string-utils';

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
  private detectors: AIToolDetector[] = [];
  private readonly DETECTOR_TIMEOUT_MS = 30000; // 30 seconds
  private readonly detectorsDir: string;

  /**
   * Creates a new AutoDetector instance.
   *
   * @param {string} [detectorsPath] - Optional custom path to detectors directory.
   *                                   Defaults to './detectors' relative to this file.
   */
  constructor(detectorsPath?: string) {
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
  async loadDetectors(): Promise<void> {
    try {
      // Read all files in the detectors directory
      const files = await fs.readdir(this.detectorsDir);

      // Filter for TypeScript/JavaScript files, excluding base-detector
      const detectorFiles = files.filter(file =>
        (file.endsWith('.ts') || file.endsWith('.js')) &&
        file !== 'base-detector.ts' &&
        file !== 'base-detector.js'
      );

      // Dynamically import each detector module
      for (const file of detectorFiles) {
        try {
          const modulePath = path.join(this.detectorsDir, file);
          const module = await import(modulePath);

          // Look for exported detector class
          // Common patterns: default export, named export, or exported instance
          const DetectorClass = module.default || module[Object.keys(module)[0]];

          if (DetectorClass) {
            // Instantiate the detector if it's a class, or use directly if it's an instance
            const detector = typeof DetectorClass === 'function'
              ? new DetectorClass()
              : DetectorClass;

            // Verify it implements the AIToolDetector interface
            if (this.isValidDetector(detector)) {
              this.detectors.push(detector);
            }
          }
        } catch (error) {
          // Log but continue if a single detector fails to load
          console.warn(`Warning: Failed to load detector from ${file}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      throw new Error(`Failed to read detectors directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates that an object implements the AIToolDetector interface.
   *
   * @private
   * @param {any} obj - Object to validate
   * @returns {boolean} True if the object is a valid detector
   */
  private isValidDetector(obj: any): obj is AIToolDetector {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.name === 'string' &&
      typeof obj.detect === 'function' &&
      typeof obj.getPaths === 'function' &&
      typeof obj.checkPATH === 'function'
    );
  }

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
  async detectAll(ecosystemFilter?: string, componentTypeFilter?: string): Promise<Map<string, DetectionResult>> {
    const results = new Map<string, DetectionResult>();

    // Filter detectors by ecosystem if specified
    let detectorsToRun = this.detectors;
    if (ecosystemFilter) {
      // First get available ecosystems for validation and suggestions
      const availableEcosystems = this.getAvailableEcosystems();

      // Normalize the ecosystem filter (map 'copilot' to 'github-copilot', etc.)
      const normalizedEcosystem = this.normalizeEcosystemName(ecosystemFilter);

      // Check if the normalized ecosystem exists in available ecosystems
      if (!availableEcosystems.includes(normalizedEcosystem)) {
        // Create a list that includes both full names and common short forms for better matching
        const ecosystemsWithAliases = [
          ...availableEcosystems,
          'copilot',    // short for github-copilot
          'claude',     // short for claude-code
          'gemini'      // short for google-gemini
        ];

        const suggestions = findClosestMatches(
          ecosystemFilter,
          ecosystemsWithAliases,
          5  // Increase max distance to catch more typos
        );

        // Map suggestions back to full ecosystem names
        const fullNameSuggestions = suggestions.map(s => {
          if (s === 'copilot') return 'github-copilot';
          if (s === 'claude') return 'claude-code';
          if (s === 'gemini') return 'google-gemini';
          return s;
        });

        // Remove duplicates from full name suggestions
        const uniqueSuggestions = [...new Set(fullNameSuggestions)];

        let errorMsg = `Invalid ecosystem name: "${ecosystemFilter}"`;
        if (uniqueSuggestions.length > 0) {
          errorMsg += `\n\nDid you mean: ${uniqueSuggestions.join(', ')}?`;
        }
        errorMsg += `\n\nAvailable ecosystems: ${availableEcosystems.join(', ')}`;

        throw new Error(errorMsg);
      }

      // Filter detectors based on normalized ecosystem
      detectorsToRun = this.detectors.filter(d => {
        // Match detector name to ecosystem
        const detectorEcosystem = d.name.replace('-detector', '');
        return detectorEcosystem === normalizedEcosystem.replace(/-/g, '') ||
               detectorEcosystem === normalizedEcosystem.replace('github-', '') ||
               d.name.includes(normalizedEcosystem.replace(/-/g, ''));
      });
    }

    // Run all detectors in parallel
    const detectionPromises = detectorsToRun.map(detector =>
      this.runDetectorWithTimeout(detector)
    );

    const detectionResults = await Promise.all(detectionPromises);

    // Filter and store only the results where components were found
    detectionResults.forEach(result => {
      if (result && result.found) {
        // Apply component type filter if specified
        if (componentTypeFilter) {
          const filteredComponents = this.filterComponentsByType(result.components, componentTypeFilter);
          if (Object.keys(filteredComponents).length > 0) {
            results.set(result.ecosystem, {
              ...result,
              components: filteredComponents
            });
          }
        } else {
          results.set(result.ecosystem, result);
        }
      }
    });

    return results;
  }

  /**
   * Runs a single detector with timeout protection and error handling.
   *
   * @private
   * @param {AIToolDetector} detector - The detector to run
   * @returns {Promise<DetectionResult | null>} Detection result or null if failed/timed out
   */
  private async runDetectorWithTimeout(detector: AIToolDetector): Promise<DetectionResult | null> {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Detector ${detector.name} timed out after ${this.DETECTOR_TIMEOUT_MS}ms`));
        }, this.DETECTOR_TIMEOUT_MS);
      });

      // Race between the detector and the timeout
      const result = await Promise.race([
        detector.detect(),
        timeoutPromise
      ]);

      return result;
    } catch (error) {
      // Log the error but continue with other detectors
      console.warn(`Warning: Detector ${detector.name} failed:`, error instanceof Error ? error.message : String(error));
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
  getDetectorCount(): number {
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
  getDetectorNames(): string[] {
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
  getAvailableEcosystems(): string[] {
    // Map detector names to ecosystem names
    // Pattern: <ecosystem>-detector -> <ecosystem>
    const ecosystems = this.detectors.map(d => {
      const name = d.name.replace('-detector', '');
      // Handle special cases - map detector name to canonical ecosystem name
      if (name === 'claudecode' || name === 'claude-code') return 'claude-code';
      if (name === 'copilot') return 'github-copilot';
      if (name === 'gemini') return 'google-gemini';
      return name;
    });

    return [...new Set(ecosystems)]; // Remove duplicates
  }

  /**
   * Normalizes an ecosystem name to match the canonical format.
   * Handles common aliases and variations.
   *
   * @private
   * @param {string} name - Ecosystem name to normalize
   * @returns {string} Normalized ecosystem name
   *
   * @example
   * normalizeEcosystemName('copilot') -> 'github-copilot'
   * normalizeEcosystemName('claude') -> 'claude-code'
   * normalizeEcosystemName('gemini') -> 'google-gemini'
   */
  private normalizeEcosystemName(name: string): string {
    const normalized = name.toLowerCase().trim();

    // Handle common aliases
    const aliases: Record<string, string> = {
      'copilot': 'github-copilot',
      'claude': 'claude-code',
      'gemini': 'google-gemini',
      'open-code': 'opencode'
    };

    return aliases[normalized] || normalized;
  }

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
  private filterComponentsByType(
    components: Record<string, ComponentInfo>,
    typeFilter: string
  ): Record<string, ComponentInfo> {
    const filtered: Record<string, ComponentInfo> = {};
    const normalizedFilter = typeFilter.toLowerCase().trim();

    for (const [key, component] of Object.entries(components)) {
      // Match by component type field
      if (component.type && component.type.toLowerCase().includes(normalizedFilter)) {
        filtered[key] = component;
        continue;
      }

      // Match by component key prefix (e.g., 'mcp-server:name')
      if (key.toLowerCase().startsWith(normalizedFilter + ':')) {
        filtered[key] = component;
        continue;
      }

      // Handle plural forms (e.g., 'hooks' -> 'hook', 'mcp-servers' -> 'mcp-server')
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
}
