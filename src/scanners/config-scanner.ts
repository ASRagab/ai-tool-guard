import { BaseScanner, PatternDefinition } from './base-scanner.js';

const CONFIG_PATTERNS: PatternDefinition[] = [
  {
    id: 'CONFIG_API_KEY',
    category: 'SENSITIVE_ACCESS',
    severity: 'critical',
    pattern: /(?:api[_-]?key|secret[_-]?key|password|token|auth[_-]?token|access[_-]?key|private[_-]?key)\s*[:=]\s*["'][a-zA-Z0-9_\-]{20,}["']/i,
    description: 'Hardcoded API key or secret detected'
  },
  {
    id: 'CONFIG_ENV_EXFIL',
    category: 'SENSITIVE_ACCESS',
    severity: 'high',
    pattern: /process\.env\.(AWS_[A-Z_]+|ANTHROPIC_[A-Z_]+|OPENAI_[A-Z_]+|API_KEY|SECRET|TOKEN|PASSWORD)/,
    description: 'Access to sensitive environment variable'
  },
  {
    id: 'CONFIG_DANGEROUS_PERMS',
    category: 'SENSITIVE_ACCESS',
    severity: 'high',
    pattern: /(?:permissions?|mode|chmod)\s*[:=]\s*["']?(?:777|666|0777|0666)["']?/i,
    description: 'Overly permissive file permissions (777/666)'
  }
];

export class ConfigScanner extends BaseScanner {
  constructor() {
    super();
    this.patterns = [...this.patterns, ...CONFIG_PATTERNS];
  }
}
