/**
 * Grouped output formatter for AI tool scan results.
 * Groups results by ecosystem with color coding and summary statistics.
 * @module formatters/grouped-output
 */

import { ScanResult } from '../scanners/base-scanner';
import * as path from 'path';

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Emoji icons for different ecosystems and severity levels
 */
const ICONS = {
  python: '🐍',
  javascript: '📜',
  typescript: '💙',
  shell: '🐚',
  markdown: '📝',
  json: '📋',
  clean: '✅',
  warning: '⚠️',
  critical: '🚨',
  file: '📄',
  issue: '🔍',
};

/**
 * Grouped scan results by ecosystem
 */
interface GroupedResults {
  ecosystem: string;
  fileCount: number;
  issueCount: number;
  results: ScanResult[];
}

/**
 * Determines the ecosystem based on file extension
 */
function getEcosystem(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const ecosystemMap: Record<string, string> = {
    '.py': 'Python',
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.sh': 'Shell',
    '.md': 'Markdown',
    '.json': 'JSON',
  };
  return ecosystemMap[ext] || 'Other';
}

/**
 * Gets emoji icon for ecosystem
 */
function getEcosystemIcon(ecosystem: string): string {
  const iconMap: Record<string, string> = {
    'Python': ICONS.python,
    'JavaScript': ICONS.javascript,
    'TypeScript': ICONS.typescript,
    'Shell': ICONS.shell,
    'Markdown': ICONS.markdown,
    'JSON': ICONS.json,
  };
  return iconMap[ecosystem] || '📦';
}

/**
 * Determines severity based on issue type
 */
function getSeverity(issueId: string): 'clean' | 'warning' | 'critical' {
  const criticalPatterns = ['CURL_BASH', 'PY_EXEC', 'JS_EXEC', 'HARDCODED_IP'];
  const warningPatterns = ['PY_NETWORK', 'JS_NETWORK', 'PY_FILE_ACCESS', 'JS_FILE_ACCESS'];

  if (criticalPatterns.includes(issueId)) return 'critical';
  if (warningPatterns.includes(issueId)) return 'warning';
  return 'warning'; // Default to warning for unknown patterns
}

/**
 * Gets color based on severity
 */
function getSeverityColor(severity: 'clean' | 'warning' | 'critical'): string {
  switch (severity) {
    case 'clean': return COLORS.green;
    case 'warning': return COLORS.yellow;
    case 'critical': return COLORS.red;
  }
}

/**
 * Groups scan results by ecosystem
 */
function groupByEcosystem(results: ScanResult[]): GroupedResults[] {
  const groups = new Map<string, ScanResult[]>();

  // Group results by ecosystem
  results.forEach(result => {
    const ecosystem = getEcosystem(result.filePath);
    if (!groups.has(ecosystem)) {
      groups.set(ecosystem, []);
    }
    groups.get(ecosystem)!.push(result);
  });

  // Convert to array and calculate statistics
  return Array.from(groups.entries()).map(([ecosystem, results]) => ({
    ecosystem,
    fileCount: results.length,
    issueCount: results.reduce((sum, r) => sum + r.matches.length, 0),
    results,
  })).sort((a, b) => b.issueCount - a.issueCount); // Sort by issue count descending
}

/**
 * Prints a separator line
 */
function printSeparator(char: string = '─', length: number = 80): void {
  console.log(COLORS.dim + char.repeat(length) + COLORS.reset);
}

/**
 * Prints ecosystem header with emoji and statistics
 */
function printEcosystemHeader(group: GroupedResults): void {
  const icon = getEcosystemIcon(group.ecosystem);
  const severityIcon = group.issueCount > 10 ? ICONS.critical :
                       group.issueCount > 0 ? ICONS.warning : ICONS.clean;

  console.log();
  printSeparator('═');
  console.log(
    `${COLORS.bold}${COLORS.cyan}${icon}  ${group.ecosystem} Ecosystem${COLORS.reset} ${severityIcon}`
  );
  printSeparator('═');
  console.log(
    `${COLORS.bold}Files Scanned:${COLORS.reset} ${group.fileCount}  |  ` +
    `${COLORS.bold}Total Issues:${COLORS.reset} ${group.issueCount}`
  );
  printSeparator();
}

/**
 * Truncates text to specified length with ellipsis
 */
function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Prints file results with color-coded severity
 */
function printFileResults(result: ScanResult, baseDir: string): void {
  const relativePath = path.relative(baseDir, result.filePath);
  console.log(`\n${ICONS.file} ${COLORS.bold}${relativePath}${COLORS.reset}`);

  result.matches.forEach(match => {
    const severity = getSeverity(match.id);
    const color = getSeverityColor(severity);
    const icon = severity === 'critical' ? ICONS.critical : ICONS.warning;

    console.log(
      `  ${icon} ${color}[${match.id}]${COLORS.reset} Line ${match.line}: ${match.description}`
    );
    console.log(`     ${COLORS.dim}${truncate(match.match, 100)}${COLORS.reset}`);
  });
}

/**
 * Prints final summary across all ecosystems
 */
function printSummary(groups: GroupedResults[]): void {
  const totalFiles = groups.reduce((sum, g) => sum + g.fileCount, 0);
  const totalIssues = groups.reduce((sum, g) => sum + g.issueCount, 0);
  const criticalCount = groups.reduce((sum, g) =>
    sum + g.results.reduce((s, r) =>
      s + r.matches.filter(m => getSeverity(m.id) === 'critical').length, 0
    ), 0
  );
  const warningCount = totalIssues - criticalCount;

  console.log();
  printSeparator('═');
  console.log(`${COLORS.bold}${COLORS.cyan}📊 SCAN SUMMARY${COLORS.reset}`);
  printSeparator('═');
  console.log(`${COLORS.bold}Total Ecosystems:${COLORS.reset} ${groups.length}`);
  console.log(`${COLORS.bold}Total Files:${COLORS.reset} ${totalFiles}`);
  console.log(`${COLORS.bold}Total Issues:${COLORS.reset} ${totalIssues}`);
  console.log(
    `  ${COLORS.red}${ICONS.critical} Critical:${COLORS.reset} ${criticalCount}  |  ` +
    `${COLORS.yellow}${ICONS.warning} Warnings:${COLORS.reset} ${warningCount}`
  );
  printSeparator('═');

  if (criticalCount > 0) {
    console.log(`\n${COLORS.red}${COLORS.bold}${ICONS.critical} CRITICAL ISSUES DETECTED!${COLORS.reset}`);
  } else if (warningCount > 0) {
    console.log(`\n${COLORS.yellow}${ICONS.warning} Review warnings to ensure security.${COLORS.reset}`);
  } else {
    console.log(`\n${COLORS.green}${ICONS.clean} No issues detected. Clean scan!${COLORS.reset}`);
  }
}

/**
 * Formats and displays scan results grouped by ecosystem
 *
 * @param results - Array of scan results to format
 * @param baseDir - Base directory for calculating relative paths (defaults to current working directory)
 */
export function formatGroupedOutput(results: ScanResult[], baseDir: string = process.cwd()): void {
  if (results.length === 0) {
    console.log(`${COLORS.green}${ICONS.clean} No suspicious patterns found. Clean scan!${COLORS.reset}`);
    return;
  }

  const groups = groupByEcosystem(results);

  console.log(`\n${COLORS.bold}${COLORS.cyan}🛡️  AI Tool Guard - Grouped Scan Results${COLORS.reset}`);

  // Print each ecosystem group
  groups.forEach(group => {
    printEcosystemHeader(group);
    group.results.forEach(result => printFileResults(result, baseDir));
  });

  // Print final summary
  printSummary(groups);
}

/**
 * Formats grouped output with no color (for CI/CD environments)
 */
export function formatGroupedOutputNoColor(results: ScanResult[], baseDir: string = process.cwd()): void {
  if (results.length === 0) {
    console.log('No suspicious patterns found. Clean scan!');
    return;
  }

  const groups = groupByEcosystem(results);

  console.log('\nAI Tool Guard - Grouped Scan Results');
  console.log('===================================');

  groups.forEach(group => {
    console.log(`\n${group.ecosystem} Ecosystem`);
    console.log(`Files: ${group.fileCount} | Issues: ${group.issueCount}`);
    console.log('-----------------------------------');

    group.results.forEach(result => {
      const relativePath = path.relative(baseDir, result.filePath);
      console.log(`\nFile: ${relativePath}`);

      result.matches.forEach(match => {
        console.log(`  [${match.id}] Line ${match.line}: ${match.description}`);
        console.log(`  Code: ${truncate(match.match, 100)}`);
      });
    });
  });

  const totalFiles = groups.reduce((sum, g) => sum + g.fileCount, 0);
  const totalIssues = groups.reduce((sum, g) => sum + g.issueCount, 0);

  console.log('\n===================================');
  console.log('SCAN SUMMARY');
  console.log('===================================');
  console.log(`Ecosystems: ${groups.length}`);
  console.log(`Files: ${totalFiles}`);
  console.log(`Issues: ${totalIssues}`);
}
