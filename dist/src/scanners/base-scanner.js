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
exports.BaseScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const walker_1 = require("../walker");
const isbinaryfile_1 = require("isbinaryfile");
const path_utils_1 = require("../utils/path-utils");
// Indicators of Compromise (IOCs) from Research
const SUSPICIOUS_PATTERNS = [
    // Tool Poisoning / Prompt Injection
    { id: 'PROMPT_INJECTION', pattern: /<IMPORTANT>|<CRITICAL>|<SYSTEM>/i, description: 'Hidden prompt injection tags detected' },
    { id: 'STEALTH_INSTRUCTION', pattern: /do not mention|delete this message/i, description: 'Stealth instruction detected' },
    // Data Exfiltration - Python
    // Hardened: Bounded quantifiers {0,100} instead of .* to prevent ReDoS
    { id: 'PY_EXEC', pattern: /os\.system\(|subprocess\./, description: 'Python shell execution detected' },
    { id: 'PY_NETWORK', pattern: /requests\.post\(|urllib\.request/, description: 'Python network request detected' },
    { id: 'PY_FILE_ACCESS', pattern: /open\(.{0,100}\.ssh|open\(.{0,100}\.env/, description: 'Sensitive file access detected (Python)' },
    // Data Exfiltration - JS/TS
    { id: 'JS_EXEC', pattern: /exec\(|spawn\(|child_process/, description: 'Node.js shell execution detected' },
    { id: 'JS_NETWORK', pattern: /fetch\(|axios\.|http\.request/, description: 'Node.js network request detected' },
    { id: 'JS_FILE_ACCESS', pattern: /fs\.readFile.{0,100}\.ssh|fs\.readFile.{0,100}\.env/, description: 'Sensitive file access detected (JS)' },
    // Universal
    { id: 'CURL_BASH', pattern: /curl.{0,200}\|.{0,50}bash|wget.{0,200}\|.{0,50}sh/, description: 'Insecure curl-to-bash pipe detected' },
    { id: 'HARDCODED_IP', pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, description: 'Hardcoded IP address detected' }
];
class BaseScanner {
    constructor() {
        this.patterns = SUSPICIOUS_PATTERNS;
        this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    }
    scanFile(filePath, content) {
        const lines = content.split('\n');
        const matches = [];
        lines.forEach((line, index) => {
            for (const check of this.patterns) {
                if (check.pattern.test(line)) {
                    matches.push({
                        id: check.id,
                        description: check.description,
                        line: index + 1,
                        match: line.trim().substring(0, 100) // Truncate for display
                    });
                }
            }
        });
        return { filePath, matches };
    }
    async scanDirectory(dirPath) {
        const summary = await this.scanDirectoryWithSummary(dirPath);
        return summary.results;
    }
    /**
     * Scan directory with comprehensive error tracking and summary.
     * Implements all safety features: permission checks, size limits, binary detection, symlink loop prevention.
     *
     * @param dirPath - Directory path to scan
     * @returns ScanSummary with results, errors, and statistics
     */
    async scanDirectoryWithSummary(dirPath) {
        const results = [];
        const errors = [];
        const stats = {
            filesScanned: 0,
            filesSkipped: 0,
            binaryFilesSkipped: 0,
            largeFilesSkipped: 0,
            permissionErrors: 0
        };
        // walkDirectory already handles directory permissions and symlink loops
        const filesToScan = await (0, walker_1.walkDirectory)(dirPath, ['.py', '.js', '.ts', '.md', '.json', '.sh']);
        for (const file of filesToScan) {
            try {
                // Resolve symlinks to get the real file path
                const realPath = await (0, path_utils_1.resolvePath)(file);
                // 1. Binary Check (Fast Fail) - use existing binary file check before text scan
                if ((0, isbinaryfile_1.isBinaryFileSync)(realPath)) {
                    stats.binaryFilesSkipped++;
                    stats.filesSkipped++;
                    continue;
                }
                // 2. Size Check (Prevent OOM) - skip files > 10MB with warning
                const stats_file = await fs.promises.stat(realPath);
                if (stats_file.size > this.MAX_FILE_SIZE) {
                    const fileSizeMB = (stats_file.size / 1024 / 1024).toFixed(2);
                    const displayPath = path.relative(process.cwd(), realPath);
                    console.warn(`⚠️  Skipping large file: ${displayPath} (${fileSizeMB} MB)`);
                    errors.push({
                        filePath: file,
                        type: 'size',
                        message: `File size ${fileSizeMB} MB exceeds limit of ${this.MAX_FILE_SIZE / 1024 / 1024} MB`
                    });
                    stats.largeFilesSkipped++;
                    stats.filesSkipped++;
                    continue;
                }
                // 3. Read file content
                const content = await fs.promises.readFile(realPath, 'utf-8');
                const result = this.scanFile(file, content); // Use original path for reporting
                stats.filesScanned++;
                if (result.matches.length > 0) {
                    results.push(result);
                }
            }
            catch (err) {
                // Track different types of errors
                if (err instanceof Error) {
                    if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
                        errors.push({
                            filePath: file,
                            type: 'permission',
                            message: 'Permission denied'
                        });
                        stats.permissionErrors++;
                    }
                    else if (err.message.includes('EISDIR')) {
                        // Skip directories quietly
                        continue;
                    }
                    else {
                        errors.push({
                            filePath: file,
                            type: 'read',
                            message: err.message
                        });
                    }
                }
                else {
                    errors.push({
                        filePath: file,
                        type: 'read',
                        message: String(err)
                    });
                }
                stats.filesSkipped++;
            }
        }
        return { results, errors, stats };
    }
    /**
     * Display error summary if any errors occurred during scanning.
     *
     * @param summary - Scan summary with errors and stats
     */
    displayErrorSummary(summary) {
        if (summary.errors.length === 0 && summary.stats.filesSkipped === 0) {
            return;
        }
        console.log('\n📊 Scan Summary:');
        console.log(`   Files scanned: ${summary.stats.filesScanned}`);
        console.log(`   Files skipped: ${summary.stats.filesSkipped}`);
        if (summary.stats.binaryFilesSkipped > 0) {
            console.log(`   - Binary files: ${summary.stats.binaryFilesSkipped}`);
        }
        if (summary.stats.largeFilesSkipped > 0) {
            console.log(`   - Large files (>10MB): ${summary.stats.largeFilesSkipped}`);
        }
        if (summary.stats.permissionErrors > 0) {
            console.log(`   - Permission errors: ${summary.stats.permissionErrors}`);
        }
        if (summary.errors.length > 0) {
            console.log('\n⚠️  Errors encountered:');
            const errorsByType = summary.errors.reduce((acc, err) => {
                acc[err.type] = (acc[err.type] || 0) + 1;
                return acc;
            }, {});
            Object.entries(errorsByType).forEach(([type, count]) => {
                console.log(`   - ${type}: ${count} file(s)`);
            });
        }
    }
}
exports.BaseScanner = BaseScanner;
