/**
 * Detector registry for automatic discovery and loading of AI tool detectors.
 * Provides a simple API to retrieve all available detector implementations.
 * @module detectors/detector-registry
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AIToolDetector } from './base-detector.js';
import { isValidDetector, getMissingDetectorProperties } from '../utils/detector-utils.js';

/**
 * Dynamically imports and validates all detector modules from the detectors directory.
 * Skips base-detector.ts and handles module loading errors gracefully.
 *
 * @returns {Promise<AIToolDetector[]>} Promise resolving to array of validated detector instances
 *
 * @example
 * ```typescript
 * import { getAllDetectors } from './detectors/detector-registry.js';
 *
 * const detectors = await getAllDetectors();
 * console.log(`Loaded ${detectors.length} detectors`);
 *
 * for (const detector of detectors) {
 *   const result = await detector.detect();
 *   console.log(`${detector.name}: ${result.found ? 'Found' : 'Not found'}`);
 * }
 * ```
 */
export async function getAllDetectors(): Promise<AIToolDetector[]> {
  const detectors: AIToolDetector[] = [];
  const detectorsDir = __dirname; // Current directory is the detectors directory

  try {
    // Read all files in the detectors directory
    const files = await fs.readdir(detectorsDir);

    // Filter for detector files: *-detector.ts or *-detector.js
    // Exclude base-detector and detector-registry files
    const detectorFiles = files.filter(file => {
      const isDetectorFile = file.endsWith('-detector.ts') || file.endsWith('-detector.js');
      const isNotBase = file !== 'base-detector.ts' && file !== 'base-detector.js';
      const isNotRegistry = file !== 'detector-registry.ts' && file !== 'detector-registry.js';
      return isDetectorFile && isNotBase && isNotRegistry;
    });

    // Dynamically import each detector module
    for (const file of detectorFiles) {
      try {
        const modulePath = path.join(detectorsDir, file);
        const module = await import(modulePath);

        // Look for exported detector class or instance
        // Common patterns: default export, named export matching *Detector pattern
        let DetectorClass = module.default;

        // If no default export, look for a named export that looks like a detector class
        if (!DetectorClass) {
          for (const key of Object.keys(module)) {
            // Skip non-constructor exports like __esModule
            if (key.startsWith('_')) continue;

            const exported = module[key];
            // Check if it's a class (function with prototype) or an object instance
            if (typeof exported === 'function' || (typeof exported === 'object' && exported !== null)) {
              DetectorClass = exported;
              break;
            }
          }
        }

        if (!DetectorClass) {
          console.warn(`Warning: No detector export found in ${file}`);
          continue;
        }

        // Instantiate the detector if it's a class, or use directly if it's an instance
        const detector = typeof DetectorClass === 'function'
          ? new DetectorClass()
          : DetectorClass;

        // Validate that it implements the AIToolDetector interface
        if (isValidDetector(detector)) {
          detectors.push(detector);
        } else {
          console.warn(
            `Warning: Detector in ${file} does not implement AIToolDetector interface correctly. ` +
            `Missing properties: ${getMissingDetectorProperties(detector)}`
          );
        }
      } catch (error) {
        // Log warning but continue loading other detectors
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Warning: Failed to load detector from ${file}: ${errorMessage}`);
      }
    }

    return detectors;
  } catch (error) {
    // If we can't read the directory, throw an error
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read detectors directory: ${errorMessage}`);
  }
}

// isValidDetector and getMissingDetectorProperties are now imported from utils/detector-utils.ts
