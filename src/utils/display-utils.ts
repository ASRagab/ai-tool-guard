/**
 * Display utilities for AI Tool Guard output.
 * Contains shared display functions to avoid duplication.
 * @module utils/display-utils
 */

import * as path from 'path';
import chalk from 'chalk';
import { ScanReport, EcosystemReport } from '../autodetect.js';

/**
 * Emoji mapping for ecosystems
 */
const ECOSYSTEM_EMOJI_MAP: Record<string, string> = {
  'claude-code': '🤖',
  'github-copilot': '🐙',
  'google-gemini': '💎',
  'opencode': '🔓',
  'codex': '📚'
};

/**
 * Get emoji for ecosystem based on name
 *
 * @param {string} ecosystem - The ecosystem name
 * @returns {string} The corresponding emoji
 */
export function getEcosystemEmoji(ecosystem: string): string {
  return ECOSYSTEM_EMOJI_MAP[ecosystem.toLowerCase()] || '🔧';
}

/**
 * Display scan report with consistent formatting.
 * Shows issues grouped by ecosystem and component, with critical/high issues
 * displayed in detail and lower severity issues grouped.
 *
 * @param {ScanReport} scanReport - The scan report to display
 * @returns {boolean} True if any issues were found
 */
export function displayScanReport(scanReport: ScanReport): boolean {
  let hasIssues = false;

  scanReport.ecosystemReports.forEach((report, ecosystem) => {
    const ecosystemEmoji = getEcosystemEmoji(ecosystem);

    console.log(chalk.bold(`${ecosystemEmoji} ${ecosystem}:`));

    if (report.totalIssues === 0) {
      console.log(chalk.green(`   ✅ No issues found\n`));
    } else {
      hasIssues = true;
      console.log(chalk.yellow(`   ⚠️  ${report.totalIssues} issue${report.totalIssues > 1 ? 's' : ''} found`));

      displayComponentScans(report);
      console.log();
    }
  });

  return hasIssues;
}

/**
 * Display component scans for an ecosystem report.
 *
 * @param {EcosystemReport} report - The ecosystem report containing component scans
 */
function displayComponentScans(report: EcosystemReport): void {
  report.componentScans.forEach((scanResults, componentKey) => {
    const componentIssues = scanResults.reduce((sum, result) => sum + result.matches.length, 0);

    if (componentIssues > 0) {
      const nonCriticalCount = scanResults.reduce(
        (sum, result) =>
          sum + result.matches.filter(match => match.severity === 'medium' || match.severity === 'low').length,
        0
      );

      console.log(chalk.cyan(`   📦 ${componentKey}: ${componentIssues} issue${componentIssues > 1 ? 's' : ''}`));

      if (nonCriticalCount > 0) {
        console.log(chalk.yellow(`      ⚠️  ${nonCriticalCount} warning${nonCriticalCount > 1 ? 's' : ''} (medium/low, grouped)`));
      }

      // Display critical and high severity issues in detail
      scanResults.forEach(result => {
        const fullPath = path.resolve(result.filePath);
        result.matches
          .filter(match => match.severity === 'critical' || match.severity === 'high')
          .forEach(match => {
            console.log(chalk.red(`      [${match.id}] ${fullPath}:${match.line} ${match.description}`));
            if (match.match) {
              console.log(chalk.dim(`      Code: "${match.match}"`));
            }
          });
      });
    }
  });
}

/**
 * Display detection summary with component counts.
 *
 * @param {Map<string, { components: Record<string, unknown> }>} results - Detection results
 */
export function displayDetectionSummary(
  results: Map<string, { components: Record<string, unknown> }>
): void {
  let totalComponents = 0;
  results.forEach((result) => {
    totalComponents += Object.keys(result.components).length;
  });

  console.log(
    chalk.green(
      `\n✅ Found ${results.size} ecosystem${results.size > 1 ? 's' : ''}, ${totalComponents} component${totalComponents > 1 ? 's' : ''}\n`
    )
  );
}
