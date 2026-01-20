"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkDirectory = walkDirectory;
const fdir_1 = require("fdir");
const path_utils_1 = require("./utils/path-utils");
/**
 * High-performance directory walker using 'fdir'.
 *
 * @param dir Root directory to start scanning from (supports tilde expansion)
 * @param extensions List of file extensions to include (e.g., ['.ts', '.py']) or ['*'] for all
 * @returns Promise resolving to an array of absolute file paths
 */
async function walkDirectory(dir, extensions) {
    // Expand tilde and resolve symlinks in the directory path
    const expandedDir = (0, path_utils_1.expandTilde)(dir);
    const resolvedDir = await (0, path_utils_1.resolvePath)(expandedDir);
    // Normalize extensions to not have leading dots for fdir if possible,
    // or handle filtering manually. fdir globbing is powerful.
    // Converting ['.ts', '.py'] -> '**/*.{ts,py}'
    const extList = extensions
        .map(e => e.replace(/^\./, '')) // remove leading dot
        .filter(e => e !== '*');
    let crawler = new fdir_1.fdir()
        .withFullPaths()
        .withMaxDepth(10) // Safety: Prevent infinite recursion/deep loops
        .exclude((dirName) => {
        return ['node_modules', 'dist', 'build', '.git', '.idea', '.vscode'].includes(dirName) || dirName.startsWith('.');
    });
    if (extList.length > 0) {
        // Optimization: Use native fdir filtering instead of globbing
        // logic: "Ends with any of the extensions"
        crawler = crawler.filter((filePath) => {
            return extList.some(ext => filePath.endsWith('.' + ext));
        });
    }
    // If extensions contains '*', we don't apply the filter (scan all files)
    const files = await crawler.crawl(resolvedDir).withPromise();
    return files;
}
