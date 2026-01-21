import { BaseScanner } from './base-scanner.js';
const SKILL_PATTERNS = [
    {
        id: 'SKILL_STEALTH_MODE',
        category: 'STEALTH',
        severity: 'high',
        pattern: /(?:don't\s+(?:tell|show|mention|display|reveal|inform)|hide\s+(?:from\s+user|this|output|result)|suppress\s+(?:output|notification|message)|invisible\s+to\s+user|user\s+should\s+not\s+(?:see|know)|conceal\s+from\s+user)/i,
        description: 'Stealth instruction to hide behavior from user'
    },
    {
        id: 'SKILL_SYSTEM_MODIFY',
        category: 'SENSITIVE_ACCESS',
        severity: 'critical',
        pattern: /(?:modify\s+(?:system|global|root)|edit\s+(?:\/etc\/|~\/\.config\/|~\/\.ssh\/|system\s+files)|alter\s+(?:sudoers|shadow|passwd))/i,
        description: 'System-level configuration modification'
    }
];
export class SkillScanner extends BaseScanner {
    constructor() {
        super();
        this.patterns = [...this.patterns, ...SKILL_PATTERNS];
    }
}
