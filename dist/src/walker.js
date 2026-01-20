"use strict";
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
exports.walkDirectory = walkDirectory;
exports.walkDirectoryWithErrors = walkDirectoryWithErrors;
const fdir_1 = require("fdir");
const fs = __importStar(require("fs"));
const path_utils_1 = require("./utils/path-utils");
/**
 * High-performance directory walker using 'fdir' with error handling and safety features.
 *
 * @param dir Root directory to start scanning from (supports tilde expansion)
 * @param extensions List of file extensions to include (e.g., ['.ts', '.py']) or ['*'] for all
 * @returns Promise resolving to an array of absolute file paths
 */
async function walkDirectory(dir, extensions) {
    const result = await walkDirectoryWithErrors(dir, extensions);
    // Log warnings for errors but return files
    result.errors.forEach(error => {
        if (error.type === 'permission') {
            console.warn(`⚠️  Permission denied: ${error.path}`);
        }
        else if (error.type === 'symlink-loop') {
            console.warn(`⚠️  Symlink loop detected: ${error.path}`);
        }
        else {
            console.warn(`⚠️  Error accessing: ${error.path} - ${error.message}`);
        }
    });
    return result.files;
}
/**
 * High-performance directory walker with detailed error reporting.
 * Includes symlink loop prevention and permission error handling.
 *
 * @param dir Root directory to start scanning from (supports tilde expansion)
 * @param extensions List of file extensions to include (e.g., ['.ts', '.py']) or ['*'] for all
 * @returns Promise resolving to WalkResult with files and errors
 */
async function walkDirectoryWithErrors(dir, extensions) {
    const errors = [];
    const visitedPaths = new Set();
    // Expand tilde and resolve symlinks in the directory path
    const expandedDir = (0, path_utils_1.expandTilde)(dir);
    let resolvedDir;
    try {
        resolvedDir = await (0, path_utils_1.resolvePath)(expandedDir);
    }
    catch (error) {
        errors.push({
            path: expandedDir,
            type: 'permission',
            message: error instanceof Error ? error.message : String(error)
        });
        return { files: [], errors };
    }
    // Check if we can access the directory
    try {
        await fs.promises.access(resolvedDir, fs.constants.R_OK);
    }
    catch (error) {
        errors.push({
            path: resolvedDir,
            type: 'permission',
            message: 'Directory not readable'
        });
        return { files: [], errors };
    }
    // Track the root path to prevent symlink loops
    visitedPaths.add(resolvedDir);
    // Normalize extensions to not have leading dots for fdir if possible,
    // or handle filtering manually. fdir globbing is powerful.
    // Converting ['.ts', '.py'] -> '**/*.{ts,py}'
    const extList = extensions
        .map(e => e.replace(/^\./, '')) // remove leading dot
        .filter(e => e !== '*');
    let crawler = new fdir_1.fdir()
        .withFullPaths()
        .withMaxDepth(10) // Safety: Prevent infinite recursion/deep loops
        .exclude((dirName, dirPath) => {
        // Exclude common directories
        if (['node_modules', 'dist', 'build', '.git', '.idea', '.vscode'].includes(dirName) || dirName.startsWith('.')) {
            return true;
        }
        // Check for symlink loops by tracking visited paths
        try {
            const stats = fs.lstatSync(dirPath);
            if (stats.isSymbolicLink()) {
                const realPath = fs.realpathSync(dirPath);
                if (visitedPaths.has(realPath)) {
                    errors.push({
                        path: dirPath,
                        type: 'symlink-loop',
                        message: 'Symlink loop detected'
                    });
                    return true;
                }
                visitedPaths.add(realPath);
            }
        }
        catch (error) {
            // Permission error or other issue - skip this directory
            errors.push({
                path: dirPath,
                type: 'permission',
                message: error instanceof Error ? error.message : String(error)
            });
            return true;
        }
        return false;
    });
    if (extList.length > 0) {
        // Optimization: Use native fdir filtering instead of globbing
        // logic: "Ends with any of the extensions"
        crawler = crawler.filter((filePath) => {
            return extList.some(ext => filePath.endsWith('.' + ext));
        });
    }
    // If extensions contains '*', we don't apply the filter (scan all files)
    let files = [];
    try {
        files = await crawler.crawl(resolvedDir).withPromise();
    }
    catch (error) {
        errors.push({
            path: resolvedDir,
            type: 'other',
            message: error instanceof Error ? error.message : String(error)
        });
    }
    return { files, errors };
}
