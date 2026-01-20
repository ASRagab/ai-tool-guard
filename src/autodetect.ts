/**
 * AutoDetector orchestrator for running multiple AI tool detectors in parallel.
 * Provides automatic loading and execution of all available detectors.
 * @module autodetect
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AIToolDetector, DetectionResult } from './detectors/base-detector';

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
   * @returns {Promise<Map<string, DetectionResult>>} Map of ecosystem names to detection results (only found ecosystems)
   *
   * @example
   * ```typescript
   * const autoDetector = new AutoDetector();
   * await autoDetector.loadDetectors();
   * const results = await autoDetector.detectAll();
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
  async detectAll(): Promise<Map<string, DetectionResult>> {
    const results = new Map<string, DetectionResult>();

    // Run all detectors in parallel
    const detectionPromises = this.detectors.map(detector =>
      this.runDetectorWithTimeout(detector)
    );

    const detectionResults = await Promise.all(detectionPromises);

    // Filter and store only the results where components were found
    detectionResults.forEach(result => {
      if (result && result.found) {
        results.set(result.ecosystem, result);
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
}
