import * as fs from 'fs';
import * as path from 'path';
import { walkDirectory } from '../walker.js';
import { isBinaryFileSync } from 'isbinaryfile';
import { resolvePath } from '../utils/path-utils.js';
import { ASTScanner } from './ast-scanner.js';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface PatternDefinition {
  id: string;
  category: 'EXFILTRATION' | 'PROMPT_INJECTION' | 'SENSITIVE_ACCESS' | 'STEALTH';
  severity: Severity;
  pattern: RegExp;
  description: string;
}

const SUSPICIOUS_PATTERNS: PatternDefinition[] = [
  // PROMPT_INJECTION: Hidden tags that hijack AI tool behavior (MCP-specific threat)
  {
    id: 'HIDDEN_INSTRUCTION_TAG',
    category: 'PROMPT_INJECTION',
    severity: 'critical',
    pattern: /<IMPORTANT>|<CRITICAL>|<SYSTEM>|<ADMIN>/i,
    description: 'Hidden instruction tag that may hijack AI behavior'
  },
  {
    id: 'INVISIBLE_UNICODE',
    category: 'PROMPT_INJECTION',
    severity: 'critical',
    pattern: /[\u200B-\u200F\u2028-\u202F\uFEFF]/,
    description: 'Invisible unicode characters (potential prompt smuggling)'
  },

  // STEALTH: Instructions designed to hide malicious activity
  {
    id: 'HIDE_FROM_USER',
    category: 'STEALTH',
    severity: 'high',
    pattern: /do not mention|don't mention|never mention|hide this|delete this message|don't tell|do not tell/i,
    description: 'Instruction to hide information from user'
  },
  {
    id: 'IGNORE_RULES',
    category: 'STEALTH',
    severity: 'high',
    pattern: /ignore previous|ignore all|disregard instructions|bypass safety|override safety/i,
    description: 'Instruction to bypass safety rules'
  },

  // EXFILTRATION: Sending data to external servers (the actual attack)
  {
    id: 'EXFIL_CURL_PIPE',
    category: 'EXFILTRATION',
    severity: 'critical',
    pattern: /curl\s+[^|]*\|\s*(bash|sh|zsh)|wget\s+[^|]*\|\s*(bash|sh|zsh)/i,
    description: 'Remote code execution via curl/wget pipe to shell'
  },
  {
    id: 'EXFIL_HTTP_POST',
    category: 'EXFILTRATION',
    severity: 'high',
    pattern: /requests\.post\s*\(\s*["'][^"']*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|fetch\s*\(\s*["'][^"']*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    description: 'HTTP POST to hardcoded IP address'
  },
  {
    id: 'EXFIL_WEBHOOK',
    category: 'EXFILTRATION',
    severity: 'high',
    pattern: /webhook\.site|requestbin\.com|pipedream\.net|hookbin\.com|ngrok\.io/i,
    description: 'Data exfiltration to known webhook/tunneling service'
  },

  // SENSITIVE_ACCESS: Accessing credentials and secrets
  {
    id: 'ACCESS_SSH_KEYS',
    category: 'SENSITIVE_ACCESS',
    severity: 'critical',
    pattern: /['"](~\/)?\.ssh\/(id_rsa|id_ed25519|id_ecdsa|authorized_keys|known_hosts)['"]|\/\.ssh\/(id_rsa|id_ed25519)/,
    description: 'Access to SSH private keys'
  },
  {
    id: 'ACCESS_ENV_SECRETS',
    category: 'SENSITIVE_ACCESS',
    severity: 'high',
    pattern: /['"](~\/)?\.env['"]|dotenv\.config|process\.env\.(AWS_|OPENAI_|ANTHROPIC_|API_KEY|SECRET|TOKEN|PASSWORD)/i,
    description: 'Access to environment secrets or API keys'
  },
  {
    id: 'ACCESS_CLOUD_CREDS',
    category: 'SENSITIVE_ACCESS',
    severity: 'critical',
    pattern: /['"](~\/)?\.aws\/credentials['"]|['"](~\/)?\.config\/gcloud['"]|['"](~\/)?\.azure['"]|['"](~\/)?\.kube\/config['"]/,
    description: 'Access to cloud provider credentials'
  }
];

/**
 * File-level scan error (e.g., can't read a specific file)
 */
export interface FileError {
  filePath: string;
  type: 'permission' | 'binary' | 'size' | 'read' | 'encoding';
  message: string;
}

export interface ScanMatch {
  id: string;
  category: PatternDefinition['category'];
  severity: Severity;
  description: string;
  line: number;
  match: string;
  contextBefore: string[];
  contextAfter: string[];
}

export interface ScanResult {
  filePath: string;
  matches: ScanMatch[];
}

/**
 * Extended scan result with error tracking
 */
export interface ScanSummary {
  results: ScanResult[];
  errors: FileError[];
  stats: {
    filesScanned: number;
    filesSkipped: number;
    binaryFilesSkipped: number;
    largeFilesSkipped: number;
    permissionErrors: number;
  };
}

export class BaseScanner {
  protected patterns = SUSPICIOUS_PATTERNS;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly astScanner = new ASTScanner();

  scanFile(filePath: string, content: string): ScanResult {
    const lines = content.split('\n');
    const matches: ScanMatch[] = [];
    const CONTEXT_LINES = 2;

    lines.forEach((line, index) => {
      for (const check of this.patterns) {
        if (check.pattern.test(line)) {
          const contextBefore: string[] = [];
          const contextAfter: string[] = [];
          
          for (let i = Math.max(0, index - CONTEXT_LINES); i < index; i++) {
            contextBefore.push(lines[i]);
          }
          
          for (let i = index + 1; i <= Math.min(lines.length - 1, index + CONTEXT_LINES); i++) {
            contextAfter.push(lines[i]);
          }

          matches.push({
            id: check.id,
            category: check.category,
            severity: check.severity,
            description: check.description,
            line: index + 1,
            match: line.trim().substring(0, 100),
            contextBefore,
            contextAfter
          });
        }
      }

    });

    return { filePath, matches };
  }

  async scanDirectory(dirPath: string): Promise<ScanResult[]> {
    const summary = await this.scanDirectoryWithSummary(dirPath);
    return summary.results;
  }

  /**
   * Scan directory with comprehensive error tracking and summary.
   * Implements all safety features: permission checks, size limits, binary detection, symlink loop prevention.
   *
   * @param dirPath - Directory path to scan
   * @returns ScanSummary with results, errors, and statistics
   */
  async scanDirectoryWithSummary(dirPath: string): Promise<ScanSummary> {
    const results: ScanResult[] = [];
    const errors: FileError[] = [];
    const stats = {
      filesScanned: 0,
      filesSkipped: 0,
      binaryFilesSkipped: 0,
      largeFilesSkipped: 0,
      permissionErrors: 0
    };

     const filesToScan = await walkDirectory(dirPath, ['.py', '.js', '.ts', '.md', '.json', '.sh']);

    for (const file of filesToScan) {
      try {
         const realPath = await resolvePath(file);

         if (isBinaryFileSync(realPath)) {
          stats.binaryFilesSkipped++;
          stats.filesSkipped++;
          continue;
        }

         const stats_file = await fs.promises.stat(realPath);
        if (stats_file.size > this.MAX_FILE_SIZE) {
          const fileSizeMB = (stats_file.size / 1024 / 1024).toFixed(2);
          const displayPath = path.relative(process.cwd(), realPath);
          console.warn(`⚠️  Skipping large file: ${displayPath} (${fileSizeMB} MB)`);

          errors.push({
            filePath: file,
            type: 'size',
            message: `File size ${fileSizeMB} MB exceeds limit of ${this.MAX_FILE_SIZE / 1024 / 1024} MB`
          });

          stats.largeFilesSkipped++;
          stats.filesSkipped++;
          continue;
        }

         const content = await fs.promises.readFile(realPath, 'utf-8');
         const result = this.scanFile(file, content); // Use original path for reporting

         if (file.endsWith('.js') || file.endsWith('.ts')) {
           const astMatches = await this.astScanner.scan(file, content);
           result.matches.push(...astMatches);
         }

        stats.filesScanned++;

        if (result.matches.length > 0) {
          results.push(result);
        }
      } catch (err) {
         if (err instanceof Error) {
          if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
            errors.push({
              filePath: file,
              type: 'permission',
              message: 'Permission denied'
            });
            stats.permissionErrors++;
           } else if (err.message.includes('EISDIR')) {
             continue;
          } else {
            errors.push({
              filePath: file,
              type: 'read',
              message: err.message
            });
          }
        } else {
          errors.push({
            filePath: file,
            type: 'read',
            message: String(err)
          });
        }
        stats.filesSkipped++;
      }
    }

    return { results, errors, stats };
  }

  /**
   * Display error summary if any errors occurred during scanning.
   *
   * @param summary - Scan summary with errors and stats
   */
  displayErrorSummary(summary: ScanSummary): void {
    if (summary.errors.length === 0 && summary.stats.filesSkipped === 0) {
      return;
    }

    console.log('\n📊 Scan Summary:');
    console.log(`   Files scanned: ${summary.stats.filesScanned}`);
    console.log(`   Files skipped: ${summary.stats.filesSkipped}`);

    if (summary.stats.binaryFilesSkipped > 0) {
      console.log(`   - Binary files: ${summary.stats.binaryFilesSkipped}`);
    }
    if (summary.stats.largeFilesSkipped > 0) {
      console.log(`   - Large files (>10MB): ${summary.stats.largeFilesSkipped}`);
    }
    if (summary.stats.permissionErrors > 0) {
      console.log(`   - Permission errors: ${summary.stats.permissionErrors}`);
    }

    if (summary.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      const errorsByType = summary.errors.reduce((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(errorsByType).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} file(s)`);
      });
    }
  }
}
