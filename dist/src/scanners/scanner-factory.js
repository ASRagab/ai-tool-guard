import { BaseScanner } from './base-scanner.js';
import { MCPScanner } from './mcp-scanner.js';
import { HookScanner } from './hook-scanner.js';
import { SkillScanner } from './skill-scanner.js';
import { ConfigScanner } from './config-scanner.js';
/**
 * Scanner cache for reusing stateless scanner instances.
 * Since scanners are stateless, we can cache and reuse them to avoid
 * unnecessary object creation overhead.
 */
const scannerCache = {};
/**
 * Selects the appropriate scanner based on component type and file path
 *
 * @param componentType - The type of component to scan (mcpServer, hook, skill, config, or unknown)
 * @param filePath - The path to the file being scanned
 * @returns The appropriate scanner instance
 *
 * @example
 * ```typescript
 * // Select scanner for MCP configuration
 * const mcpScanner = selectScanner('mcpServer', '/path/to/mcp.json');
 *
 * // Select scanner based on file path containing 'mcp'
 * const mcpScanner2 = selectScanner('unknown', '/config/mcp-server.json');
 *
 * // Select scanner for hook file
 * const hookScanner = selectScanner('hook', '/hooks/pre-commit.sh');
 *
 * // Select scanner for skill file
 * const skillScanner = selectScanner('skill', '/skills/auto-agent.md');
 *
 * // Select scanner for config file
 * const configScanner = selectScanner('config', '/config/settings.json');
 *
 * // Fallback to base scanner
 * const baseScanner = selectScanner('unknown', '/src/index.ts');
 * ```
 */
export function selectScanner(componentType, filePath) {
    // Normalize file path for consistent matching
    const normalizedPath = filePath.toLowerCase();
    // Determine the effective component type (explicit or inferred from path)
    let effectiveType = componentType;
    // Priority 2: Path-based detection (when componentType is 'unknown')
    if (componentType === 'unknown') {
        if (normalizedPath.includes('mcp')) {
            effectiveType = 'mcpServer';
        }
        else if (normalizedPath.includes('hooks/') || normalizedPath.includes('hooks\\')) {
            effectiveType = 'hook';
        }
        else if (normalizedPath.includes('skills/') || normalizedPath.includes('skills\\')) {
            effectiveType = 'skill';
        }
        else if (normalizedPath.endsWith('.json') || normalizedPath.includes('config')) {
            effectiveType = 'config';
        }
    }
    // Return cached scanner if available
    const cachedScanner = scannerCache[effectiveType];
    if (cachedScanner) {
        return cachedScanner;
    }
    // Create and cache the scanner
    let scanner;
    switch (effectiveType) {
        case 'mcpServer':
            scanner = new MCPScanner();
            break;
        case 'hook':
            scanner = new HookScanner();
            break;
        case 'skill':
            scanner = new SkillScanner();
            break;
        case 'config':
            scanner = new ConfigScanner();
            break;
        default:
            scanner = new BaseScanner();
    }
    scannerCache[effectiveType] = scanner;
    return scanner;
}
/**
 * Creates a scanner instance based on file extension and path patterns
 * Convenience function that infers component type from file path
 *
 * @param filePath - The path to the file being scanned
 * @returns The appropriate scanner instance
 */
export function createScannerForFile(filePath) {
    return selectScanner('unknown', filePath);
}
