import { BaseScanner } from './base-scanner';
import { MCPScanner } from './mcp-scanner';
import { HookScanner } from './hook-scanner';
import { SkillScanner } from './skill-scanner';
import { ConfigScanner } from './config-scanner';

/**
 * Scanner Factory - selects the appropriate scanner based on component type and file path
 *
 * Supports:
 * - MCP Server scanning (mcp.json, MCP configurations)
 * - Hook scanning (shell scripts in hooks directories)
 * - Skill/Agent scanning (Claude Code skills and autonomous agents)
 * - Config scanning (JSON configuration files)
 * - Base scanning (fallback for unknown types)
 */

export type ComponentType = 'mcpServer' | 'hook' | 'skill' | 'config' | 'unknown';

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
export function selectScanner(componentType: ComponentType, filePath: string): BaseScanner {
  // Normalize file path for consistent matching
  const normalizedPath = filePath.toLowerCase();

  // Priority 1: Explicit component type
  if (componentType === 'mcpServer') {
    return new MCPScanner();
  }

  if (componentType === 'hook') {
    return new HookScanner();
  }

  if (componentType === 'skill') {
    return new SkillScanner();
  }

  if (componentType === 'config') {
    return new ConfigScanner();
  }

  // Priority 2: Path-based detection (when componentType is 'unknown')

  // Check for MCP-related files
  if (normalizedPath.includes('mcp')) {
    return new MCPScanner();
  }

  // Check for hook files (hooks directory or hook-related files)
  if (normalizedPath.includes('hooks/') || normalizedPath.includes('hooks\\')) {
    return new HookScanner();
  }

  // Check for skill files (skills directory or skill-related files)
  if (normalizedPath.includes('skills/') || normalizedPath.includes('skills\\')) {
    return new SkillScanner();
  }

  // Check for JSON configuration files (including config directory)
  if (normalizedPath.endsWith('.json') || normalizedPath.includes('config')) {
    return new ConfigScanner();
  }

  // Priority 3: Fallback to base scanner for unknown types
  return new BaseScanner();
}

/**
 * Creates a scanner instance based on file extension and path patterns
 * Convenience function that infers component type from file path
 *
 * @param filePath - The path to the file being scanned
 * @returns The appropriate scanner instance
 */
export function createScannerForFile(filePath: string): BaseScanner {
  return selectScanner('unknown', filePath);
}
