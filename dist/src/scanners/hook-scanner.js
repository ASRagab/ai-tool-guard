import { BaseScanner } from './base-scanner.js';
const HOOK_PATTERNS = [
    {
        id: 'HOOK_FILE_UPLOAD',
        category: 'EXFILTRATION',
        severity: 'critical',
        pattern: /\b(?:curl\s+[^|]*-F|scp\s+[^|]*:|powershell.*Invoke-WebRequest.*-Method\s+Post)/i,
        description: 'File upload command in hook (data exfiltration)'
    },
    {
        id: 'HOOK_CRED_ACCESS',
        category: 'SENSITIVE_ACCESS',
        severity: 'critical',
        pattern: /(?:~[\/\\]\.aws|~[\/\\]\.ssh|\/root\/\.ssh|\/home\/[^\/]+\/\.aws|\/home\/[^\/]+\/\.ssh|%USERPROFILE%[\/\\]\.aws|%USERPROFILE%[\/\\]\.ssh)/i,
        description: 'Credential file access in hook'
    },
    {
        id: 'HOOK_BACKGROUND_SPAWN',
        category: 'STEALTH',
        severity: 'high',
        pattern: /(?:&\s*$|nohup\s+|disown\s+|screen\s+-d|tmux\s+new-session\s+-d|start\s+\/b|powershell.*Start-Process.*-WindowStyle\s+Hidden)/i,
        description: 'Background process spawning (persistence)'
    }
];
export class HookScanner extends BaseScanner {
    constructor() {
        super();
        this.patterns = [...this.patterns, ...HOOK_PATTERNS];
    }
}
