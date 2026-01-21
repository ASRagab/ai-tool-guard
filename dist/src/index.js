#!/usr/bin/env node
import { BaseScanner } from './scanners/base-scanner.js';
import { AutoDetector } from './autodetect.js';
import { Command } from 'commander';
import { expandTilde, resolvePath } from './utils/path-utils.js';
import { displayScanReport, displayDetectionSummary, getEcosystemEmoji } from './utils/display-utils.js';
import prompts from 'prompts';
import chalk from 'chalk';
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
        .action(async (targetPath, options) => {
        const expandedPath = expandTilde(targetPath);
        const targetDir = await resolvePath(expandedPath);
        if (options.autoDetect) {
            console.log(chalk.blue('🤖 Running in automatic detection mode...\n'));
            try {
                const autoDetector = new AutoDetector();
                await autoDetector.loadDetectors();
                console.log(chalk.cyan('🔍 Detecting...'));
                if (options.type) {
                    console.log(chalk.cyan(`🔍 Filtering for component type: ${options.type}`));
                }
                const results = await autoDetector.detectAll(undefined, options.type);
                if (results.size === 0) {
                    console.log(chalk.green('✅ No AI tools or components detected.'));
                    process.exit(0);
                }
                displayDetectionSummary(results);
                console.log(chalk.blue('🔒 Scanning detected components...\n'));
                const scanReport = await autoDetector.scanDetected(results);
                const hasIssues = displayScanReport(scanReport);
                autoDetector.displayFailureSummary();
                console.log(chalk.bold(`\n🎯 Scan complete. Total issues: ${scanReport.totalIssues}`));
                process.exit(hasIssues ? 1 : 0);
            }
            catch (error) {
                console.error(chalk.red('❌ Error during auto-detection:'), error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        }
        else if (options.detectInteractive) {
            console.log(chalk.blue('💬 Running in interactive detection mode...\n'));
            try {
                const autoDetector = new AutoDetector();
                await autoDetector.loadDetectors();
                console.log(chalk.cyan('🔍 Detecting...'));
                if (options.type) {
                    console.log(chalk.cyan(`🔍 Filtering for component type: ${options.type}`));
                }
                const results = await autoDetector.detectAll(undefined, options.type);
                if (results.size === 0) {
                    console.log(chalk.green('✅ No AI tools or components detected.'));
                    process.exit(0);
                }
                console.log(chalk.bold('\n📊 Detection Results:\n'));
                const ecosystemData = [];
                results.forEach((result, ecosystem) => {
                    const componentCount = Object.keys(result.components).length;
                    const ecosystemEmoji = getEcosystemEmoji(ecosystem);
                    ecosystemData.push({ ecosystem, componentCount, emoji: ecosystemEmoji });
                    console.log(chalk.bold(`${ecosystemEmoji} ${ecosystem}: ${componentCount} component${componentCount > 1 ? 's' : ''}`));
                    Object.entries(result.components).forEach(([key, component]) => {
                        console.log(chalk.cyan(`   📦 ${key}: ${component.path}`));
                    });
                    console.log();
                });
                const scanAllResponse = await prompts({
                    type: 'confirm',
                    name: 'scanAll',
                    message: 'Scan all detected tools?',
                    initial: true
                });
                if (scanAllResponse.scanAll === undefined) {
                    console.log(chalk.red('\n❌ Operation cancelled by user.'));
                    process.exit(0);
                }
                let selectedEcosystems;
                if (scanAllResponse.scanAll) {
                    selectedEcosystems = Array.from(results.keys());
                }
                else {
                    const ecosystemChoices = ecosystemData.map(({ ecosystem, componentCount, emoji }) => ({
                        title: `${emoji} ${ecosystem} (${componentCount} component${componentCount > 1 ? 's' : ''})`,
                        value: ecosystem,
                        selected: true
                    }));
                    const ecosystemResponse = await prompts({
                        type: 'multiselect',
                        name: 'ecosystems',
                        message: 'Select ecosystems to scan (use space to toggle, enter to confirm)',
                        choices: ecosystemChoices,
                        hint: '- Space to select. Enter to submit'
                    });
                    if (ecosystemResponse.ecosystems === undefined) {
                        console.log(chalk.red('\n❌ Operation cancelled by user.'));
                        process.exit(0);
                    }
                    selectedEcosystems = ecosystemResponse.ecosystems;
                    if (selectedEcosystems.length === 0) {
                        console.log(chalk.yellow('\n⚠️  No ecosystems selected. Exiting.'));
                        process.exit(0);
                    }
                }
                const filteredResults = new Map();
                selectedEcosystems.forEach(ecosystem => {
                    const result = results.get(ecosystem);
                    if (result) {
                        filteredResults.set(ecosystem, result);
                    }
                });
                let totalComponents = 0;
                filteredResults.forEach((result) => {
                    totalComponents += Object.keys(result.components).length;
                });
                console.log(chalk.blue(`\n🔒 Scanning ${selectedEcosystems.length} ecosystem${selectedEcosystems.length > 1 ? 's' : ''}, ${totalComponents} component${totalComponents > 1 ? 's' : ''}...\n`));
                const scanReport = await autoDetector.scanDetected(filteredResults);
                const hasIssues = displayScanReport(scanReport);
                autoDetector.displayFailureSummary();
                console.log(chalk.bold(`\n🎯 Scan complete. Total issues: ${scanReport.totalIssues}`));
                process.exit(hasIssues ? 1 : 0);
            }
            catch (error) {
                console.error(chalk.red('❌ Error during interactive detection:'), error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        }
        else if (options.detect) {
            console.log(chalk.cyan(`🎯 Detecting ecosystem: ${options.detect}`));
            try {
                const autoDetector = new AutoDetector();
                await autoDetector.loadDetectors();
                if (options.type) {
                    console.log(chalk.cyan(`🔍 Filtering for component type: ${options.type}`));
                }
                const results = await autoDetector.detectAll(options.detect, options.type);
                if (results.size === 0) {
                    console.log(chalk.green(`✅ No components found for ecosystem: ${options.detect}`));
                    process.exit(0);
                }
                results.forEach((result, ecosystem) => {
                    console.log(chalk.bold(`\n📦 ${ecosystem}:`));
                    Object.entries(result.components).forEach(([key, component]) => {
                        console.log(chalk.green(`   ✓ ${key}: ${component.path}`));
                    });
                });
                autoDetector.displayFailureSummary();
                process.exit(0);
            }
            catch (error) {
                console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        }
        console.log(chalk.bold.blue(`🛡️  AI Tool Guard: Scanning ${targetDir}...\n`));
        const scanner = new BaseScanner();
        const summary = await scanner.scanDirectoryWithSummary(targetDir);
        if (summary.results.length === 0) {
            console.log(chalk.green('✅ No threats detected.'));
            scanner.displayErrorSummary(summary);
            process.exit(0);
        }
        const { formatGroupedOutput } = require('./formatters/grouped-output');
        formatGroupedOutput(summary.results, process.cwd());
        scanner.displayErrorSummary(summary);
        const hasSignificantIssues = summary.results.some(r => r.matches.some(m => m.severity === 'critical' || m.severity === 'high'));
        process.exit(hasSignificantIssues ? 1 : 0);
    });
    await program.parseAsync(process.argv);
}
main().catch(console.error);
