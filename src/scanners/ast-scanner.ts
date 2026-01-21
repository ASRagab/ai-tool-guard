import { AstAnalyser } from '@nodesecure/js-x-ray';
import type { ScanMatch, Severity } from './base-scanner.js';

const XRAY_SEVERITY_MAP: Record<string, Severity> = {
  Critical: 'critical',
  Warning: 'medium',
  Information: 'low'
};

const XRAY_DESCRIPTION_MAP: Record<string, string> = {
  'shady-link': 'Suspicious URL or IP literal (js-x-ray shady-link)',
  'obfuscated-code': 'Obfuscated code / Trojan Source-style deception (js-x-ray obfuscated-code)'
};

function getWarningLine(warning: any): number {
  const location = Array.isArray(warning?.location) ? warning.location[0] : warning?.location;
  return location?.start?.line ?? location?.line ?? 1;
}

function getWarningDescription(kind: string, value?: string | null): string {
  if (XRAY_DESCRIPTION_MAP[kind]) {
    return XRAY_DESCRIPTION_MAP[kind];
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return `js-x-ray ${kind}`;
}

export class ASTScanner {
  private analyser = new AstAnalyser();

  async scan(filePath: string, content: string): Promise<ScanMatch[]> {
    const result = this.analyser.analyse(content);

    if (!result?.warnings || result.warnings.length === 0) {
      return [];
    }

    return result.warnings.map((warning: any) => {
      const line = getWarningLine(warning);
      const severity: Severity = XRAY_SEVERITY_MAP[warning.severity] ?? 'medium';
      const value = typeof warning.value === 'string' ? warning.value : '';

      return {
        id: `JSXRAY_${warning.kind ?? 'UNKNOWN'}`,
        category: 'SENSITIVE_ACCESS',
        severity,
        description: getWarningDescription(warning.kind ?? 'unknown', value),
        line,
        match: value,
        contextBefore: [],
        contextAfter: []
      };
    });
  }
}
