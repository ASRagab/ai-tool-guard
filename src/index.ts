#!/usr/bin/env node
import { BaseScanner } from './scanners/base-scanner';
import * as path from 'path';
import { Command } from 'commander';

interface ScanOptions {
  autoDetect?: boolean;
  detectInteractive?: boolean;
  detect?: string;
  type?: string;
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
      const targetDir = path.resolve(targetPath);

      // Display scan mode
      if (options.autoDetect) {
        console.log('🤖 Running in automatic detection mode...');
      } else if (options.detectInteractive) {
        console.log('💬 Running in interactive detection mode...');
      } else if (options.detect) {
        console.log(`🎯 Detecting ecosystem: ${options.detect}`);
      }

      if (options.type) {
        console.log(`🔍 Filtering for component type: ${options.type}`);
      }

      console.log(`🛡️  AI Tool Guard: Scanning ${targetDir}...`);

      const scanner = new BaseScanner();
      const results = await scanner.scanDirectory(targetDir);

      if (results.length === 0) {
        console.log('✅ No suspicious patterns found.');
        process.exit(0);
      }

      console.log(`\n⚠️  Found ${results.length} files with suspicious patterns:\n`);

      let totalIssues = 0;

      results.forEach(result => {
        console.log(`📄 File: ${path.relative(process.cwd(), result.filePath)}`);
        result.matches.forEach(match => {
          totalIssues++;
          console.log(`   [${match.id}] Line ${match.line}: ${match.description}`);
          console.log(`   Code: "${match.match}"\n`);
        });
      });

      console.log(`🚨 Scan complete. Found ${totalIssues} potential issues.`);
      process.exit(1);
    });

  await program.parseAsync(process.argv);
}

main().catch(console.error);
