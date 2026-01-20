"use strict";
/**
 * Detector registry for automatic discovery and loading of AI tool detectors.
 * Provides a simple API to retrieve all available detector implementations.
 * @module detectors/detector-registry
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
exports.getAllDetectors = getAllDetectors;
const fs_1 = require("fs");
const path = __importStar(require("path"));
/**
 * Dynamically imports and validates all detector modules from the detectors directory.
 * Skips base-detector.ts and handles module loading errors gracefully.
 *
 * @returns {Promise<AIToolDetector[]>} Promise resolving to array of validated detector instances
 *
 * @example
 * ```typescript
 * import { getAllDetectors } from './detectors/detector-registry';
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
async function getAllDetectors() {
    const detectors = [];
    const detectorsDir = __dirname; // Current directory is the detectors directory
    try {
        // Read all files in the detectors directory
        const files = await fs_1.promises.readdir(detectorsDir);
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
                const module = await Promise.resolve(`${modulePath}`).then(s => __importStar(require(s)));
                // Look for exported detector class or instance
                // Common patterns: default export, named export, or first exported item
                const DetectorClass = module.default || module[Object.keys(module)[0]];
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
                }
                else {
                    console.warn(`Warning: Detector in ${file} does not implement AIToolDetector interface correctly. ` +
                        `Missing properties: ${getMissingProperties(detector)}`);
                }
            }
            catch (error) {
                // Log warning but continue loading other detectors
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.warn(`Warning: Failed to load detector from ${file}: ${errorMessage}`);
            }
        }
        return detectors;
    }
    catch (error) {
        // If we can't read the directory, throw an error
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read detectors directory: ${errorMessage}`);
    }
}
/**
 * Validates that an object implements the AIToolDetector interface.
 *
 * @private
 * @param {any} obj - Object to validate
 * @returns {boolean} True if the object is a valid detector
 */
function isValidDetector(obj) {
    return (obj &&
        typeof obj === 'object' &&
        typeof obj.name === 'string' &&
        obj.name.length > 0 &&
        typeof obj.detect === 'function' &&
        typeof obj.getPaths === 'function' &&
        typeof obj.checkPATH === 'function');
}
/**
 * Returns a comma-separated list of missing required properties for debugging.
 *
 * @private
 * @param {any} obj - Object to check
 * @returns {string} List of missing properties
 */
function getMissingProperties(obj) {
    const missing = [];
    if (!obj || typeof obj !== 'object') {
        return 'not an object';
    }
    if (typeof obj.name !== 'string' || obj.name.length === 0) {
        missing.push('name (string)');
    }
    if (typeof obj.detect !== 'function') {
        missing.push('detect (function)');
    }
    if (typeof obj.getPaths !== 'function') {
        missing.push('getPaths (function)');
    }
    if (typeof obj.checkPATH !== 'function') {
        missing.push('checkPATH (function)');
    }
    return missing.join(', ');
}
