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
        const results = [];
        const filesToScan = await (0, walker_1.walkDirectory)(dirPath, ['.py', '.js', '.ts', '.md', '.json', '.sh']);
        for (const file of filesToScan) {
            try {
                // Resolve symlinks to get the real file path
                const realPath = await (0, path_utils_1.resolvePath)(file);
                // 1. Binary Check (Fast Fail)
                // We use the sync version here as we are already inside an async loop
                // and want to quickly skip without overhead.
                if ((0, isbinaryfile_1.isBinaryFileSync)(realPath)) {
                    continue;
                }
                // 2. Size Check (Prevent OOM)
                const stats = await fs.promises.stat(realPath);
                if (stats.size > 10 * 1024 * 1024) { // Skip files > 10MB
                    console.warn(`Skipping large file: ${path.basename(realPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                    continue;
                }
                const content = await fs.promises.readFile(realPath, 'utf-8');
                const result = this.scanFile(file, content); // Use original path for reporting
                if (result.matches.length > 0) {
                    results.push(result);
                }
            }
            catch (err) {
                // Ignore read errors (permissions, etc)
                // console.debug(`Failed to read ${file}:`, err);
            }
        }
        return results;
    }
}
exports.BaseScanner = BaseScanner;
