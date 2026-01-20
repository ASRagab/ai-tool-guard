"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigScanner = void 0;
const base_scanner_1 = require("./base-scanner");
/**
 * Config Scanner - specialized scanner for configuration files
 * Detects hardcoded secrets, insecure protocols, dangerous permissions, and sensitive env var access
 */
// Config-specific security patterns
const CONFIG_PATTERNS = [
    {
        id: 'CONFIG_API_KEY',
        pattern: /(?:api[_-]?key|secret[_-]?key|password|token|auth[_-]?token|access[_-]?key|private[_-]?key)\s*[:=]\s*["'][a-zA-Z0-9_\-]{20,}["']/i,
        description: 'Hardcoded API key or secret detected (20+ characters) - potential credential exposure'
    },
    {
        id: 'CONFIG_ENV_EXFIL',
        pattern: /process\.env\.(AWS_[A-Z_]+|ANTHROPIC_[A-Z_]+|OPENAI_[A-Z_]+|API_KEY|SECRET|TOKEN|PASSWORD)/,
        description: 'Access to sensitive environment variable detected (AWS, ANTHROPIC, OPENAI) - potential credential exfiltration'
    },
    {
        id: 'CONFIG_INSECURE_PROTOCOL',
        pattern: /(?:url|endpoint|host|server)\s*[:=]\s*["']http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
        description: 'HTTP protocol used instead of HTTPS - insecure communication channel (excludes localhost)'
    },
    {
        id: 'CONFIG_DANGEROUS_PERMS',
        pattern: /(?:permissions?|mode|chmod)\s*[:=]\s*["']?(?:777|666|0777|0666)["']?/i,
        description: 'Overly permissive file permissions detected (777/666) - security risk'
    }
];
class ConfigScanner extends base_scanner_1.BaseScanner {
    constructor() {
        super();
        // Add config-specific patterns to the base patterns
        this.patterns = [...this.patterns, ...CONFIG_PATTERNS];
    }
}
exports.ConfigScanner = ConfigScanner;
