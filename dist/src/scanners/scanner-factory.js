"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectScanner = selectScanner;
exports.createScannerForFile = createScannerForFile;
const base_scanner_1 = require("./base-scanner");
const mcp_scanner_1 = require("./mcp-scanner");
const hook_scanner_1 = require("./hook-scanner");
const skill_scanner_1 = require("./skill-scanner");
const config_scanner_1 = require("./config-scanner");
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
function selectScanner(componentType, filePath) {
    // Normalize file path for consistent matching
    const normalizedPath = filePath.toLowerCase();
    // Priority 1: Explicit component type
    if (componentType === 'mcpServer') {
        return new mcp_scanner_1.MCPScanner();
    }
    if (componentType === 'hook') {
        return new hook_scanner_1.HookScanner();
    }
    if (componentType === 'skill') {
        return new skill_scanner_1.SkillScanner();
    }
    if (componentType === 'config') {
        return new config_scanner_1.ConfigScanner();
    }
    // Priority 2: Path-based detection (when componentType is 'unknown')
    // Check for MCP-related files
    if (normalizedPath.includes('mcp')) {
        return new mcp_scanner_1.MCPScanner();
    }
    // Check for hook files (hooks directory or hook-related files)
    if (normalizedPath.includes('hooks/') || normalizedPath.includes('hooks\\')) {
        return new hook_scanner_1.HookScanner();
    }
    // Check for skill files (skills directory or skill-related files)
    if (normalizedPath.includes('skills/') || normalizedPath.includes('skills\\')) {
        return new skill_scanner_1.SkillScanner();
    }
    // Check for JSON configuration files (including config directory)
    if (normalizedPath.endsWith('.json') || normalizedPath.includes('config')) {
        return new config_scanner_1.ConfigScanner();
    }
    // Priority 3: Fallback to base scanner for unknown types
    return new base_scanner_1.BaseScanner();
}
/**
 * Creates a scanner instance based on file extension and path patterns
 * Convenience function that infers component type from file path
 *
 * @param filePath - The path to the file being scanned
 * @returns The appropriate scanner instance
 */
function createScannerForFile(filePath) {
    return selectScanner('unknown', filePath);
}
