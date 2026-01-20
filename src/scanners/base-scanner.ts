import * as fs from 'fs';
import * as path from 'path';
import { walkDirectory } from '../walker';
import { isBinaryFileSync } from 'isbinaryfile';

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

export interface ScanResult {
  filePath: string;
  matches: {
    id: string;
    description: string;
    line: number;
    match: string;
  }[];
}

export class BaseScanner {
  protected patterns = SUSPICIOUS_PATTERNS;

  scanFile(filePath: string, content: string): ScanResult {
    const lines = content.split('\n');
    const matches: ScanResult['matches'] = [];

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

  async scanDirectory(dirPath: string): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const filesToScan = await walkDirectory(dirPath, ['.py', '.js', '.ts', '.md', '.json', '.sh']);

    for (const file of filesToScan) {
      try {
        // 1. Binary Check (Fast Fail)
        // We use the sync version here as we are already inside an async loop
        // and want to quickly skip without overhead.
        if (isBinaryFileSync(file)) {
            continue;
        }

        // 2. Size Check (Prevent OOM)
        const stats = await fs.promises.stat(file);
        if (stats.size > 10 * 1024 * 1024) { // Skip files > 10MB
            console.warn(`Skipping large file: ${path.basename(file)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            continue;
        }

        const content = await fs.promises.readFile(file, 'utf-8');
        const result = this.scanFile(file, content);
        if (result.matches.length > 0) {
          results.push(result);
        }
      } catch (err) {
        // Ignore read errors (permissions, etc)
        // console.debug(`Failed to read ${file}:`, err);
      }
    }

    return results;
  }
}
