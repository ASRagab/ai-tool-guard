import * as path from 'path';
import chalk from 'chalk';
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
function getEcosystem(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const ecosystemMap = {
        '.py': 'Python',
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.sh': 'Shell',
        '.md': 'Markdown',
        '.json': 'JSON',
    };
    return ecosystemMap[ext] || 'Other';
}
function getEcosystemIcon(ecosystem) {
    const iconMap = {
        'Python': ICONS.python,
        'JavaScript': ICONS.javascript,
        'TypeScript': ICONS.typescript,
        'Shell': ICONS.shell,
        'Markdown': ICONS.markdown,
        'JSON': ICONS.json,
    };
    return iconMap[ecosystem] || '📦';
}
function mapSeverityToDisplay(severity) {
    if (severity === 'critical')
        return 'critical';
    if (severity === 'high' || severity === 'medium')
        return 'warning';
    return 'clean';
}
function getSeverityChalk(severity) {
    switch (severity) {
        case 'clean': return chalk.green;
        case 'warning': return chalk.yellow;
        case 'critical': return chalk.red;
    }
}
function groupByEcosystem(results) {
    const groups = new Map();
    results.forEach(result => {
        const ecosystem = getEcosystem(result.filePath);
        if (!groups.has(ecosystem)) {
            groups.set(ecosystem, []);
        }
        groups.get(ecosystem).push(result);
    });
    return Array.from(groups.entries()).map(([ecosystem, results]) => ({
        ecosystem,
        fileCount: results.length,
        issueCount: results.reduce((sum, r) => sum + r.matches.length, 0),
        results,
    })).sort((a, b) => b.issueCount - a.issueCount);
}
function printSeparator(char = '─', length = 80) {
    console.log(chalk.dim(char.repeat(length)));
}
function printEcosystemHeader(group) {
    const icon = getEcosystemIcon(group.ecosystem);
    const severityIcon = group.issueCount > 10 ? ICONS.critical :
        group.issueCount > 0 ? ICONS.warning : ICONS.clean;
    console.log();
    printSeparator('═');
    console.log(chalk.bold.cyan(`${icon}  ${group.ecosystem} Ecosystem`) + ` ${severityIcon}`);
    printSeparator('═');
    console.log(`${chalk.bold('Files Scanned:')} ${group.fileCount}  |  ` +
        `${chalk.bold('Total Issues:')} ${group.issueCount}`);
    printSeparator();
}
function truncate(text, maxLength = 100) {
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength - 3) + '...';
}
function printFileResults(result, baseDir) {
    const fullPath = path.resolve(result.filePath);
    console.log(`\n${ICONS.file} ${chalk.bold(fullPath)}`);
    const criticalMatches = result.matches.filter(match => match.severity === 'critical' || match.severity === 'high');
    const nonCriticalMatches = result.matches.filter(match => match.severity === 'medium' || match.severity === 'low');
    if (nonCriticalMatches.length > 0) {
        console.log(chalk.yellow(`  ${ICONS.warning} ${nonCriticalMatches.length} warning${nonCriticalMatches.length > 1 ? 's' : ''} (medium/low, grouped)`));
    }
    criticalMatches.forEach(match => {
        const displaySeverity = mapSeverityToDisplay(match.severity);
        const colorFn = getSeverityChalk(displaySeverity);
        const icon = displaySeverity === 'critical' ? ICONS.critical : ICONS.warning;
        console.log(`  ${icon} ${colorFn(`[${match.category}]`)} Line ${match.line}: ${match.description}`);
        if (match.contextBefore.length > 0) {
            match.contextBefore.forEach((line, idx) => {
                const lineNum = match.line - match.contextBefore.length + idx;
                console.log(chalk.dim(`     ${lineNum} | ${line}`));
            });
        }
        console.log(chalk.bold(`  →  ${match.line} | ${truncate(match.match, 100)}`));
        if (match.contextAfter.length > 0) {
            match.contextAfter.forEach((line, idx) => {
                const lineNum = match.line + idx + 1;
                console.log(chalk.dim(`     ${lineNum} | ${line}`));
            });
        }
        console.log();
    });
}
function printSummary(groups) {
    const totalFiles = groups.reduce((sum, g) => sum + g.fileCount, 0);
    const totalIssues = groups.reduce((sum, g) => sum + g.issueCount, 0);
    const criticalCount = groups.reduce((sum, g) => sum + g.results.reduce((s, r) => s + r.matches.filter(m => m.severity === 'critical').length, 0), 0);
    const warningCount = totalIssues - criticalCount;
    console.log();
    printSeparator('═');
    console.log(chalk.bold.cyan('📊 SCAN SUMMARY'));
    printSeparator('═');
    console.log(`${chalk.bold('Total Ecosystems:')} ${groups.length}`);
    console.log(`${chalk.bold('Total Files:')} ${totalFiles}`);
    console.log(`${chalk.bold('Total Issues:')} ${totalIssues}`);
    console.log(`  ${chalk.red(`${ICONS.critical} Critical:`)} ${criticalCount}  |  ` +
        `${chalk.yellow(`${ICONS.warning} Warnings:`)} ${warningCount}`);
    printSeparator('═');
    if (criticalCount > 0) {
        console.log(`\n${chalk.red.bold(`${ICONS.critical} CRITICAL ISSUES DETECTED!`)}`);
    }
    else if (warningCount > 0) {
        console.log(`\n${chalk.yellow(`${ICONS.warning} Review warnings to ensure security.`)}`);
    }
    else {
        console.log(`\n${chalk.green(`${ICONS.clean} No issues detected. Clean scan!`)}`);
    }
}
export function formatGroupedOutput(results, baseDir = process.cwd()) {
    if (results.length === 0) {
        console.log(chalk.green(`${ICONS.clean} No suspicious patterns found. Clean scan!`));
        return;
    }
    const groups = groupByEcosystem(results);
    console.log(`\n${chalk.bold.cyan('🛡️  AI Tool Guard - Grouped Scan Results')}`);
    groups.forEach(group => {
        printEcosystemHeader(group);
        group.results.forEach(result => printFileResults(result, baseDir));
    });
    printSummary(groups);
}
export function formatGroupedOutputNoColor(results, baseDir = process.cwd()) {
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
            const fullPath = path.resolve(result.filePath);
            console.log(`\nFile: ${fullPath}`);
            const criticalMatches = result.matches.filter(match => match.severity === 'critical' || match.severity === 'high');
            const nonCriticalMatches = result.matches.filter(match => match.severity === 'medium' || match.severity === 'low');
            if (nonCriticalMatches.length > 0) {
                console.log(`  Warnings (grouped): ${nonCriticalMatches.length}`);
            }
            criticalMatches.forEach(match => {
                console.log(`  [${match.id}] Line ${match.line}: ${match.description}`);
                console.log(`  Code: ${truncate(match.match, 100)}`);
                if (match.contextBefore.length > 0) {
                    match.contextBefore.forEach((line, idx) => {
                        const lineNum = match.line - match.contextBefore.length + idx;
                        console.log(`    ${lineNum} | ${line}`);
                    });
                }
                console.log(`  → ${match.line} | ${match.match}`);
                if (match.contextAfter.length > 0) {
                    match.contextAfter.forEach((line, idx) => {
                        const lineNum = match.line + idx + 1;
                        console.log(`    ${lineNum} | ${line}`);
                    });
                }
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
