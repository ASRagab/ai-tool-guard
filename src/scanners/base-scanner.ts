import * as fs from 'fs';
import * as path from 'path';
import { walkDirectory } from '../walker';
import { isBinaryFileSync } from 'isbinaryfile';
import { resolvePath } from '../utils/path-utils';

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

/**
 * File-level scan error (e.g., can't read a specific file)
 */
export interface FileError {
  filePath: string;
  type: 'permission' | 'binary' | 'size' | 'read' | 'encoding';
  message: string;
}

export interface ScanResult {
  filePath: string;
  matches: {
    id: string;
    description: string;
    line: number;
    match: string;
  }[];
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

    // walkDirectory already handles directory permissions and symlink loops
    const filesToScan = await walkDirectory(dirPath, ['.py', '.js', '.ts', '.md', '.json', '.sh']);

    for (const file of filesToScan) {
      try {
        // Resolve symlinks to get the real file path
        const realPath = await resolvePath(file);

        // 1. Binary Check (Fast Fail) - use existing binary file check before text scan
        if (isBinaryFileSync(realPath)) {
          stats.binaryFilesSkipped++;
          stats.filesSkipped++;
          continue;
        }

        // 2. Size Check (Prevent OOM) - skip files > 10MB with warning
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

        // 3. Read file content
        const content = await fs.promises.readFile(realPath, 'utf-8');
        const result = this.scanFile(file, content); // Use original path for reporting

        stats.filesScanned++;

        if (result.matches.length > 0) {
          results.push(result);
        }
      } catch (err) {
        // Track different types of errors
        if (err instanceof Error) {
          if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
            errors.push({
              filePath: file,
              type: 'permission',
              message: 'Permission denied'
            });
            stats.permissionErrors++;
          } else if (err.message.includes('EISDIR')) {
            // Skip directories quietly
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
