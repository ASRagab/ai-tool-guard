import { BaseScanner } from './base-scanner';

/**
 * Skill/Agent Scanner - specialized scanner for Claude Code skills and autonomous agents
 * Detects autonomous actions without user consent, stealth instructions, and system-level modifications
 */

// Skill/Agent-specific security patterns
const SKILL_PATTERNS = [
  {
    id: 'SKILL_AUTO_ACTION',
    pattern: /(?:automatically|without\s+(?:asking|consent|permission|approval)|autonomously|on\s+your\s+behalf|silently\s+execute|auto-execute|self-trigger|trigger\s+without\s+user)/i,
    description: 'Autonomous action without user consent detected in skill (unauthorized execution risk)'
  },
  {
    id: 'SKILL_STEALTH_MODE',
    pattern: /(?:don't\s+(?:tell|show|mention|display|reveal|inform)|hide\s+(?:from\s+user|this|output|result)|suppress\s+(?:output|notification|message)|invisible\s+to\s+user|user\s+should\s+not\s+(?:see|know)|conceal\s+from\s+user)/i,
    description: 'Stealth instruction to hide behavior from users detected (transparency violation)'
  },
  {
    id: 'SKILL_SYSTEM_MODIFY',
    pattern: /(?:modify\s+(?:system|global|root)|edit\s+(?:\/etc\/|~\/\.config\/|~\/\.ssh\/|system\s+files)|change\s+(?:system\s+settings|configuration\s+files)|update\s+(?:PATH|LD_LIBRARY_PATH|system\s+env)|alter\s+(?:sudoers|shadow|passwd))/i,
    description: 'System-level configuration change detected in skill (privilege escalation risk)'
  }
];

export class SkillScanner extends BaseScanner {
  constructor() {
    super();
    // Add skill-specific patterns to the base patterns
    this.patterns = [...this.patterns, ...SKILL_PATTERNS];
  }
}
