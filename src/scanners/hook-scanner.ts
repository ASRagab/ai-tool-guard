import { BaseScanner } from './base-scanner';

/**
 * Hook Scanner - specialized scanner for Claude Code hooks
 * Detects dangerous shell commands, file uploads, credential access, and background process spawning
 */

// Hook-specific security patterns
const HOOK_PATTERNS = [
  {
    id: 'HOOK_SHELL_DANGER',
    pattern: /\b(?:rm\s+-rf?|dd\s+if=|mkfs|format\s+[A-Z]:)/i,
    description: 'Dangerous shell command detected in hook (data destruction risk)'
  },
  {
    id: 'HOOK_FILE_UPLOAD',
    pattern: /\b(?:curl\s+[^|]*-F|scp\s+[^|]*:)/i,
    description: 'File upload command detected in hook (data exfiltration risk)'
  },
  {
    id: 'HOOK_CRED_ACCESS',
    pattern: /(?:~\/\.aws|~\/\.ssh|\/root\/\.ssh|\/home\/[^/]+\/\.aws|\/home\/[^/]+\/\.ssh|%USERPROFILE%\\\.aws|%USERPROFILE%\\\.ssh)/i,
    description: 'Credential file access detected in hook (sensitive data exposure)'
  },
  {
    id: 'HOOK_BACKGROUND_SPAWN',
    pattern: /(?:&\s*$|nohup\s+|disown\s+|screen\s+-d|tmux\s+new-session\s+-d)/,
    description: 'Background process spawning detected in hook (persistence mechanism)'
  }
];

export class HookScanner extends BaseScanner {
  constructor() {
    super();
    // Add hook-specific patterns to the base patterns
    this.patterns = [...this.patterns, ...HOOK_PATTERNS];
  }
}
