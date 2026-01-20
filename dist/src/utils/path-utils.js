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
exports.isWindows = isWindows;
exports.expandTilde = expandTilde;
exports.resolvePath = resolvePath;
exports.resolvePathSync = resolvePathSync;
exports.parsePATH = parsePATH;
exports.safePath = safePath;
exports.isSymlink = isSymlink;
exports.getHomeDir = getHomeDir;
exports.normalizePath = normalizePath;
exports.getAppDataDir = getAppDataDir;
exports.getLocalAppDataDir = getLocalAppDataDir;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
/**
 * Cross-platform path handling utilities for Windows, macOS, and Linux.
 * Provides robust path operations with tilde expansion and symlink resolution.
 */
/**
 * Checks if the current platform is Windows.
 *
 * @returns True if running on Windows, false otherwise
 */
function isWindows() {
    return process.platform === 'win32';
}
/**
 * Expands tilde (~) or %USERPROFILE% to the user's home directory.
 * Works on Windows, macOS, and Linux.
 *
 * @param filePath - Path potentially containing tilde or %USERPROFILE%
 * @returns Expanded absolute path
 *
 * @example
 * expandTilde('~/documents') // Returns '/Users/username/documents' on macOS
 * expandTilde('~/.config')   // Returns '/Users/username/.config' on macOS
 * expandTilde('%USERPROFILE%\\.config') // Returns 'C:\\Users\\username\\.config' on Windows
 * expandTilde('/absolute')   // Returns '/absolute' (no change)
 */
function expandTilde(filePath) {
    const homeDir = os.homedir();
    // Handle Windows %USERPROFILE% environment variable
    if (isWindows() && filePath.includes('%USERPROFILE%')) {
        return filePath.replace(/%USERPROFILE%/g, homeDir);
    }
    // Handle Unix-like tilde expansion
    if (filePath.startsWith('~/') || filePath === '~') {
        return filePath === '~'
            ? homeDir
            : path.join(homeDir, filePath.slice(2));
    }
    return filePath;
}
/**
 * Resolves a path and follows symlinks to get the real absolute path.
 * Uses fs.promises.realpath() for proper symlink resolution.
 *
 * @param filePath - Path to resolve (can include tilde)
 * @returns Promise resolving to the real absolute path
 *
 * @example
 * await resolvePath('~/link-to-dir')  // Resolves symlink and returns real path
 * await resolvePath('./relative')      // Resolves to absolute path
 */
async function resolvePath(filePath) {
    const expanded = expandTilde(filePath);
    try {
        return await fs.promises.realpath(expanded);
    }
    catch (error) {
        // If realpath fails (e.g., path doesn't exist), return the expanded absolute path
        return path.resolve(expanded);
    }
}
/**
 * Synchronous version of resolvePath for cases where async is not possible.
 *
 * @param filePath - Path to resolve (can include tilde)
 * @returns The real absolute path
 */
function resolvePathSync(filePath) {
    const expanded = expandTilde(filePath);
    try {
        return fs.realpathSync(expanded);
    }
    catch (error) {
        // If realpath fails, return the expanded absolute path
        return path.resolve(expanded);
    }
}
/**
 * Parses the PATH environment variable using platform-specific delimiter.
 * Uses semicolon (;) on Windows, colon (:) on Unix-like systems.
 * Handles tilde expansion and filters out empty entries.
 *
 * @returns Array of absolute directory paths from PATH
 *
 * @example
 * parsePATH() // Returns ['/usr/local/bin', '/usr/bin', '/bin', '/Users/user/.local/bin'] on Unix
 * parsePATH() // Returns ['C:\\Windows\\System32', 'C:\\Program Files\\nodejs'] on Windows
 */
function parsePATH() {
    const pathEnv = process.env.PATH || '';
    const delimiter = isWindows() ? ';' : ':';
    return pathEnv
        .split(delimiter)
        .filter(p => p.length > 0)
        .map(p => expandTilde(p.trim()))
        .map(p => path.resolve(p));
}
/**
 * Safely joins path segments using path.join() for cross-platform compatibility.
 * Also expands tilde in the first segment if present.
 *
 * @param segments - Path segments to join
 * @returns Joined absolute path
 *
 * @example
 * safePath('~', '.config', 'app')      // Returns '/Users/username/.config/app'
 * safePath('/usr', 'local', 'bin')     // Returns '/usr/local/bin'
 */
function safePath(...segments) {
    if (segments.length === 0) {
        return '';
    }
    const [first, ...rest] = segments;
    const expandedFirst = expandTilde(first);
    return path.join(expandedFirst, ...rest);
}
/**
 * Checks if a path is a symlink.
 *
 * @param filePath - Path to check
 * @returns Promise resolving to true if path is a symlink
 */
async function isSymlink(filePath) {
    try {
        const stats = await fs.promises.lstat(filePath);
        return stats.isSymbolicLink();
    }
    catch (error) {
        return false;
    }
}
/**
 * Gets the home directory for the current user.
 * Works on Windows (%USERPROFILE%), macOS, and Linux.
 *
 * @returns The absolute path to the user's home directory
 *
 * @example
 * getHomeDir() // Returns '/Users/username' on macOS or '/home/username' on Linux
 * getHomeDir() // Returns 'C:\\Users\\username' on Windows
 */
function getHomeDir() {
    return os.homedir();
}
/**
 * Normalizes path separators for the current platform.
 * Converts all forward slashes to backslashes on Windows,
 * and all backslashes to forward slashes on Unix-like systems.
 *
 * @param filePath - Path with potentially mixed separators
 * @returns Path with normalized separators for the current platform
 *
 * @example
 * normalizePath('~/.config/app') // Returns '~/.config/app' on Unix
 * normalizePath('~/.config/app') // Returns '~\\.config\\app' on Windows
 * normalizePath('C:\\Users\\name') // Returns 'C:\\Users\\name' on Windows
 * normalizePath('C:\\Users\\name') // Returns 'C:/Users/name' on Unix
 */
function normalizePath(filePath) {
    if (isWindows()) {
        // On Windows, convert all forward slashes to backslashes
        return filePath.replace(/\//g, '\\');
    }
    else {
        // On Unix-like systems, convert all backslashes to forward slashes
        return filePath.replace(/\\/g, '/');
    }
}
/**
 * Gets the Windows APPDATA directory or returns null on non-Windows platforms.
 *
 * @returns The absolute path to APPDATA on Windows, or null on other platforms
 *
 * @example
 * getAppDataDir() // Returns 'C:\\Users\\username\\AppData\\Roaming' on Windows
 * getAppDataDir() // Returns null on macOS/Linux
 */
function getAppDataDir() {
    if (isWindows()) {
        return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    }
    return null;
}
/**
 * Gets the Windows LocalAppData directory or returns null on non-Windows platforms.
 *
 * @returns The absolute path to LocalAppData on Windows, or null on other platforms
 *
 * @example
 * getLocalAppDataDir() // Returns 'C:\\Users\\username\\AppData\\Local' on Windows
 * getLocalAppDataDir() // Returns null on macOS/Linux
 */
function getLocalAppDataDir() {
    if (isWindows()) {
        return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    }
    return null;
}
