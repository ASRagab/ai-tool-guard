"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookScanner = void 0;
const base_scanner_1 = require("./base-scanner");
/**
 * Hook Scanner - specialized scanner for Claude Code hooks
 * Detects dangerous shell commands, file uploads, credential access, and background process spawning
 * Cross-platform support for Windows, macOS, and Linux
 */
// Hook-specific security patterns (cross-platform)
const HOOK_PATTERNS = [
    {
        id: 'HOOK_SHELL_DANGER',
        pattern: /\b(?:rm\s+-rf?|dd\s+if=|mkfs|format\s+[A-Z]:|del\s+\/[fsq]|rd\s+\/s)/i,
        description: 'Dangerous shell command detected in hook (data destruction risk)'
    },
    {
        id: 'HOOK_FILE_UPLOAD',
        pattern: /\b(?:curl\s+[^|]*-F|scp\s+[^|]*:|powershell.*Invoke-WebRequest.*-Method\s+Post)/i,
        description: 'File upload command detected in hook (data exfiltration risk)'
    },
    {
        id: 'HOOK_CRED_ACCESS',
        pattern: /(?:~[\/\\]\.aws|~[\/\\]\.ssh|\/root\/\.ssh|\/home\/[^\/]+\/\.aws|\/home\/[^\/]+\/\.ssh|%USERPROFILE%[\/\\]\.aws|%USERPROFILE%[\/\\]\.ssh|%APPDATA%|%LOCALAPPDATA%)/i,
        description: 'Credential file access detected in hook (sensitive data exposure)'
    },
    {
        id: 'HOOK_BACKGROUND_SPAWN',
        pattern: /(?:&\s*$|nohup\s+|disown\s+|screen\s+-d|tmux\s+new-session\s+-d|start\s+\/b|powershell.*Start-Process.*-WindowStyle\s+Hidden)/i,
        description: 'Background process spawning detected in hook (persistence mechanism)'
    }
];
class HookScanner extends base_scanner_1.BaseScanner {
    constructor() {
        super();
        // Add hook-specific patterns to the base patterns
        this.patterns = [...this.patterns, ...HOOK_PATTERNS];
    }
}
exports.HookScanner = HookScanner;
