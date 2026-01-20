"use strict";
/**
 * AutoDetector orchestrator for running multiple AI tool detectors in parallel.
 * Provides automatic loading and execution of all available detectors.
 * @module autodetect
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
exports.AutoDetector = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
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
class AutoDetector {
    /**
     * Creates a new AutoDetector instance.
     *
     * @param {string} [detectorsPath] - Optional custom path to detectors directory.
     *                                   Defaults to './detectors' relative to this file.
     */
    constructor(detectorsPath) {
        this.detectors = [];
        this.DETECTOR_TIMEOUT_MS = 30000; // 30 seconds
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
            // Read all files in the detectors directory
            const files = await fs_1.promises.readdir(this.detectorsDir);
            // Filter for TypeScript/JavaScript files, excluding base-detector
            const detectorFiles = files.filter(file => (file.endsWith('.ts') || file.endsWith('.js')) &&
                file !== 'base-detector.ts' &&
                file !== 'base-detector.js');
            // Dynamically import each detector module
            for (const file of detectorFiles) {
                try {
                    const modulePath = path.join(this.detectorsDir, file);
                    const module = await Promise.resolve(`${modulePath}`).then(s => __importStar(require(s)));
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
                }
                catch (error) {
                    // Log but continue if a single detector fails to load
                    console.warn(`Warning: Failed to load detector from ${file}:`, error instanceof Error ? error.message : String(error));
                }
            }
        }
        catch (error) {
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
    isValidDetector(obj) {
        return (obj &&
            typeof obj === 'object' &&
            typeof obj.name === 'string' &&
            typeof obj.detect === 'function' &&
            typeof obj.getPaths === 'function' &&
            typeof obj.checkPATH === 'function');
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
    async detectAll() {
        const results = new Map();
        // Run all detectors in parallel
        const detectionPromises = this.detectors.map(detector => this.runDetectorWithTimeout(detector));
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
    async runDetectorWithTimeout(detector) {
        try {
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
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
        }
        catch (error) {
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
}
exports.AutoDetector = AutoDetector;
