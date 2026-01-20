#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_scanner_1 = require("./scanners/base-scanner");
const autodetect_1 = require("./autodetect");
const path = __importStar(require("path"));
const commander_1 = require("commander");
const path_utils_1 = require("./utils/path-utils");
const prompts_1 = __importDefault(require("prompts"));
/**
 * Get emoji for ecosystem based on name
 */
function getEcosystemEmoji(ecosystem) {
    const emojiMap = {
        'claude-code': '🤖',
        'github-copilot': '🐙',
        'google-gemini': '💎',
        'opencode': '🔓',
        'codex': '📚'
    };
    return emojiMap[ecosystem.toLowerCase()] || '🔧';
}
async function main() {
    const program = new commander_1.Command();
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
        // Expand tilde and resolve symlinks in the target path
        const expandedPath = (0, path_utils_1.expandTilde)(targetPath);
        const targetDir = await (0, path_utils_1.resolvePath)(expandedPath);
        // Display scan mode
        if (options.autoDetect) {
            console.log('🤖 Running in automatic detection mode...\n');
            try {
                // Use AutoDetector for ecosystem/component detection
                const autoDetector = new autodetect_1.AutoDetector();
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
                    }
                    else {
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
            }
            catch (error) {
                console.error('❌ Error during auto-detection:', error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        }
        else if (options.detectInteractive) {
            console.log('💬 Running in interactive detection mode...\n');
            try {
                // Use AutoDetector for ecosystem/component detection
                const autoDetector = new autodetect_1.AutoDetector();
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
                // Display detection results grouped by ecosystem with component counts
                console.log('\n📊 Detection Results:\n');
                const ecosystemData = [];
                results.forEach((result, ecosystem) => {
                    const componentCount = Object.keys(result.components).length;
                    const ecosystemEmoji = getEcosystemEmoji(ecosystem);
                    ecosystemData.push({ ecosystem, componentCount, emoji: ecosystemEmoji });
                    console.log(`${ecosystemEmoji} ${ecosystem}: ${componentCount} component${componentCount > 1 ? 's' : ''}`);
                    Object.entries(result.components).forEach(([key, component]) => {
                        console.log(`   📦 ${key}: ${component.path}`);
                    });
                    console.log();
                });
                // Prompt: Scan all detected tools?
                const scanAllResponse = await (0, prompts_1.default)({
                    type: 'confirm',
                    name: 'scanAll',
                    message: 'Scan all detected tools?',
                    initial: true
                });
                // Handle user cancellation (Ctrl+C)
                if (scanAllResponse.scanAll === undefined) {
                    console.log('\n❌ Operation cancelled by user.');
                    process.exit(0);
                }
                let selectedEcosystems;
                if (scanAllResponse.scanAll) {
                    // Scan all ecosystems
                    selectedEcosystems = Array.from(results.keys());
                }
                else {
                    // Show multi-select list with ecosystems as checkboxes
                    const ecosystemChoices = ecosystemData.map(({ ecosystem, componentCount, emoji }) => ({
                        title: `${emoji} ${ecosystem} (${componentCount} component${componentCount > 1 ? 's' : ''})`,
                        value: ecosystem,
                        selected: true // Default to selected
                    }));
                    const ecosystemResponse = await (0, prompts_1.default)({
                        type: 'multiselect',
                        name: 'ecosystems',
                        message: 'Select ecosystems to scan (use space to toggle, enter to confirm)',
                        choices: ecosystemChoices,
                        hint: '- Space to select. Enter to submit'
                    });
                    // Handle user cancellation
                    if (ecosystemResponse.ecosystems === undefined) {
                        console.log('\n❌ Operation cancelled by user.');
                        process.exit(0);
                    }
                    selectedEcosystems = ecosystemResponse.ecosystems;
                    if (selectedEcosystems.length === 0) {
                        console.log('\n⚠️  No ecosystems selected. Exiting.');
                        process.exit(0);
                    }
                }
                // Filter results to only selected ecosystems
                const filteredResults = new Map();
                selectedEcosystems.forEach(ecosystem => {
                    const result = results.get(ecosystem);
                    if (result) {
                        filteredResults.set(ecosystem, result);
                    }
                });
                // Calculate total components to scan
                let totalComponents = 0;
                filteredResults.forEach((result) => {
                    totalComponents += Object.keys(result.components).length;
                });
                // Display scanning summary
                console.log(`\n🔒 Scanning ${selectedEcosystems.length} ecosystem${selectedEcosystems.length > 1 ? 's' : ''}, ${totalComponents} component${totalComponents > 1 ? 's' : ''}...\n`);
                // Scan only selected ecosystems
                const scanReport = await autoDetector.scanDetected(filteredResults);
                // Display results in same format as automatic mode
                let hasIssues = false;
                scanReport.ecosystemReports.forEach((report, ecosystem) => {
                    // Determine ecosystem emoji
                    const ecosystemEmoji = getEcosystemEmoji(ecosystem);
                    console.log(`${ecosystemEmoji} ${ecosystem}:`);
                    if (report.totalIssues === 0) {
                        console.log(`   ✅ No issues found\n`);
                    }
                    else {
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
            }
            catch (error) {
                console.error('❌ Error during interactive detection:', error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        }
        else if (options.detect) {
            console.log(`🎯 Detecting ecosystem: ${options.detect}`);
            try {
                // Use AutoDetector for specific ecosystem detection
                const autoDetector = new autodetect_1.AutoDetector();
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
            }
            catch (error) {
                console.error('❌ Error:', error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        }
        // Default scanning mode (existing behavior)
        console.log(`🛡️  AI Tool Guard: Scanning ${targetDir}...`);
        const scanner = new base_scanner_1.BaseScanner();
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
