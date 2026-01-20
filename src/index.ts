#!/usr/bin/env node
import { BaseScanner } from './scanners/base-scanner';
import { AutoDetector } from './autodetect';
import * as path from 'path';
import { Command } from 'commander';
import { expandTilde, resolvePath } from './utils/path-utils';

interface ScanOptions {
  autoDetect?: boolean;
  detectInteractive?: boolean;
  detect?: string;
  type?: string;
}

/**
 * Get emoji for ecosystem based on name
 */
function getEcosystemEmoji(ecosystem: string): string {
  const emojiMap: Record<string, string> = {
    'claude-code': '🤖',
    'github-copilot': '🐙',
    'google-gemini': '💎',
    'opencode': '🔓',
    'codex': '📚'
  };

  return emojiMap[ecosystem.toLowerCase()] || '🔧';
}

async function main() {
  const program = new Command();

  program
    .name('ai-tool-guard')
    .description('Security scanner for AI tools and extensions')
    .version('1.0.0')
    .argument('[path]', 'Path to scan (defaults to current directory)', process.cwd())
    .option('-a, --auto-detect', 'Automatic detection mode')
    .option('-i, --detect-interactive', 'Interactive detection mode')
    .option('--detect <ecosystem>', 'Single ecosystem detection (e.g., mcp, cursor, vscode)')
    .option('--type <component-type>', 'Filter by specific component type')
    .action(async (targetPath: string, options: ScanOptions) => {
      // Expand tilde and resolve symlinks in the target path
      const expandedPath = expandTilde(targetPath);
      const targetDir = await resolvePath(expandedPath);

      // Display scan mode
      if (options.autoDetect) {
        console.log('🤖 Running in automatic detection mode...\n');

        try {
          // Use AutoDetector for ecosystem/component detection
          const autoDetector = new AutoDetector();
          await autoDetector.loadDetectors();

          // Detection phase with progress indicator
          console.log('🔍 Detecting...');

          if (options.type) {
            console.log(`🔍 Filtering for component type: ${options.type}`);
          }

          const results = await autoDetector.detectAll(undefined, options.type);

          if (results.size === 0) {
            console.log('✅ No AI tools or components detected.');
            process.exit(0);
          }

          // Calculate total components across all ecosystems
          let totalComponents = 0;
          results.forEach((result) => {
            totalComponents += Object.keys(result.components).length;
          });

          // Display detection summary
          console.log(`\n✅ Found ${results.size} ecosystem${results.size > 1 ? 's' : ''}, ${totalComponents} component${totalComponents > 1 ? 's' : ''}\n`);

          // Scanning phase
          console.log('🔒 Scanning detected components...\n');

          const scanReport = await autoDetector.scanDetected(results);

          // Display results grouped by ecosystem with emoji indicators
          let hasIssues = false;
          scanReport.ecosystemReports.forEach((report, ecosystem) => {
            // Determine ecosystem emoji
            const ecosystemEmoji = getEcosystemEmoji(ecosystem);

            console.log(`${ecosystemEmoji} ${ecosystem}:`);

            if (report.totalIssues === 0) {
              console.log(`   ✅ No issues found\n`);
            } else {
              hasIssues = true;
              console.log(`   ⚠️  ${report.totalIssues} issue${report.totalIssues > 1 ? 's' : ''} found`);

              // Display issues by component
              report.componentScans.forEach((scanResults, componentKey) => {
                const componentIssues = scanResults.reduce((sum, result) => sum + result.matches.length, 0);
                if (componentIssues > 0) {
                  console.log(`   📦 ${componentKey}: ${componentIssues} issue${componentIssues > 1 ? 's' : ''}`);

                  // Display each issue
                  scanResults.forEach(result => {
                    result.matches.forEach(match => {
                      console.log(`      [${match.id}] Line ${match.line}: ${match.description}`);
                      console.log(`      Code: "${match.match}"`);
                    });
                  });
                }
              });
              console.log();
            }
          });

          // Display detector failure summary if any
          autoDetector.displayFailureSummary();

          // Summary footer
          console.log(`\n🎯 Scan complete. Total issues: ${scanReport.totalIssues}`);

          // Exit with appropriate code
          process.exit(hasIssues ? 1 : 0);
        } catch (error) {
          console.error('❌ Error during auto-detection:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      } else if (options.detectInteractive) {
        console.log('💬 Running in interactive detection mode...');
      } else if (options.detect) {
        console.log(`🎯 Detecting ecosystem: ${options.detect}`);

        try {
          // Use AutoDetector for specific ecosystem detection
          const autoDetector = new AutoDetector();
          await autoDetector.loadDetectors();

          if (options.type) {
            console.log(`🔍 Filtering for component type: ${options.type}`);
          }

          const results = await autoDetector.detectAll(options.detect, options.type);

          if (results.size === 0) {
            console.log(`✅ No components found for ecosystem: ${options.detect}`);
            process.exit(0);
          }

          results.forEach((result, ecosystem) => {
            console.log(`\n📦 ${ecosystem}:`);
            Object.entries(result.components).forEach(([key, component]) => {
              console.log(`   ✓ ${key}: ${component.path}`);
            });
          });

          // Display detector failure summary if any
          autoDetector.displayFailureSummary();

          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }

      // Default scanning mode (existing behavior)
      console.log(`🛡️  AI Tool Guard: Scanning ${targetDir}...`);

      const scanner = new BaseScanner();
      const summary = await scanner.scanDirectoryWithSummary(targetDir);

      if (summary.results.length === 0) {
        console.log('✅ No suspicious patterns found.');
        scanner.displayErrorSummary(summary);
        process.exit(0);
      }

      console.log(`\n⚠️  Found ${summary.results.length} files with suspicious patterns:\n`);

      let totalIssues = 0;

      summary.results.forEach(result => {
        console.log(`📄 File: ${path.relative(process.cwd(), result.filePath)}`);
        result.matches.forEach(match => {
          totalIssues++;
          console.log(`   [${match.id}] Line ${match.line}: ${match.description}`);
          console.log(`   Code: "${match.match}"\n`);
        });
      });

      console.log(`🚨 Scan complete. Found ${totalIssues} potential issues.`);
      scanner.displayErrorSummary(summary);
      process.exit(1);
    });

  await program.parseAsync(process.argv);
}

main().catch(console.error);
