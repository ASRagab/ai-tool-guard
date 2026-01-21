/**
 * Claude Code Detector - detects Claude Code installation and components
 * Scans for plugins, skills, hooks, and MCP servers in Claude Code directories
 * @module detectors/claude-code-detector
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AIToolDetector, ComponentInfo, DetectionResult } from './base-detector.js';
import { expandTilde, parsePATH, resolvePath, isSymlink } from '../utils/path-utils.js';
import { detectDirectory } from '../utils/detector-utils.js';

/**
 * Detector for Claude Code CLI and its components.
 * Searches for:
 * - Claude Code executable in PATH
 * - Plugins in ~/.claude/plugins/
 * - Skills in ~/.claude/skills/
 * - Hooks in ~/.claude/hooks/
 * - MCP servers in ~/.claude/mcp.json
 * - Config files in ~/.config/claude/
 *
 * @class ClaudeCodeDetector
 * @implements {AIToolDetector}
 *
 * @example
 * ```typescript
 * const detector = new ClaudeCodeDetector();
 * const result = await detector.detect();
 *
 * if (result.found) {
 *   console.log('Claude Code installation detected');
 *   Object.entries(result.components).forEach(([name, info]) => {
 *     console.log(`  ${name}: ${info.path} (${info.type})`);
 *   });
 * }
 * ```
 */
export class ClaudeCodeDetector implements AIToolDetector {
  readonly name = 'claude-code-detector';

  /**
   * Returns the list of directories to scan for Claude Code components.
   * Includes both the primary installation directory and the config directory.
   *
   * @returns {string[]} Array of paths to scan:
   *   - ~/.claude/ (primary installation)
   *   - ~/.config/claude/ (configuration)
   *
   * @example
   * ```typescript
   * const detector = new ClaudeCodeDetector();
   * const paths = detector.getPaths();
   * // Returns: ['/Users/username/.claude', '/Users/username/.config/claude']
   * ```
   */
  getPaths(): string[] {
    return [
      expandTilde('~/.claude/'),
      expandTilde('~/.config/claude/')
    ];
  }

  /**
   * Scans the system PATH for the claude executable.
   * Resolves symlinks to find the actual installation location.
   *
   * @returns {Promise<ComponentInfo[]>} Array of found executables with resolved paths
   *
   * @example
   * ```typescript
   * const detector = new ClaudeCodeDetector();
   * const pathComponents = await detector.checkPATH();
   * // Returns: [{ name: 'claude', path: '/opt/homebrew/bin/claude', type: 'executable' }]
   * ```
   */
  async checkPATH(): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];
    const pathDirs = parsePATH();

    for (const dir of pathDirs) {
      try {
        const claudePath = path.join(dir, 'claude');

        // Check if the executable exists
        try {
          await fs.access(claudePath, fs.constants.X_OK);
        } catch {
          // Not executable or doesn't exist, skip
          continue;
        }

        // Resolve symlinks to get the real path
        let resolvedPath = claudePath;
        if (await isSymlink(claudePath)) {
          try {
            resolvedPath = await resolvePath(claudePath);
          } catch {
            // If symlink resolution fails, use the original path
            resolvedPath = claudePath;
          }
        }

        components.push({
          name: 'claude',
          path: resolvedPath,
          type: 'executable'
        });

        // Found one instance, no need to check other PATH directories
        break;
      } catch (error) {
        // Silently continue to next directory
        continue;
      }
    }

    return components;
  }

  /**
   * Performs a comprehensive detection scan for Claude Code installation.
   * Detects:
   * - Plugins in ~/.claude/plugins/
   * - Skills in ~/.claude/skills/
   * - Hooks in ~/.claude/hooks/
   * - MCP servers defined in ~/.claude/mcp.json
   * - Claude executable in PATH
   *
   * @returns {Promise<DetectionResult>} Detection results with all found components
   *
   * @example
   * ```typescript
   * const detector = new ClaudeCodeDetector();
   * const result = await detector.detect();
   *
   * if (result.found) {
   *   console.log(`Found ${Object.keys(result.components).length} components`);
   *   console.log(`Scanned paths: ${result.scanPaths.join(', ')}`);
   * }
   * ```
   */
  async detect(): Promise<DetectionResult> {
    const components: Record<string, ComponentInfo> = {};
    const scanPaths = this.getPaths();

    // Check for claude executable in PATH
    const pathComponents = await this.checkPATH();
    pathComponents.forEach(comp => {
      components[`executable:${comp.name}`] = comp;
    });

    // Detect plugins in ~/.claude/plugins/
    const pluginsPath = expandTilde('~/.claude/plugins/');
    const plugins = await detectDirectory(pluginsPath, 'plugin');
    plugins.forEach(comp => {
      components[`plugin:${comp.name}`] = comp;
    });

    // Detect skills in ~/.claude/skills/
    const skillsPath = expandTilde('~/.claude/skills/');
    const skills = await detectDirectory(skillsPath, 'skill');
    skills.forEach(comp => {
      components[`skill:${comp.name}`] = comp;
    });

    // Detect hooks in ~/.claude/hooks/
    const hooksPath = expandTilde('~/.claude/hooks/');
    const hooks = await detectDirectory(hooksPath, 'hook');
    hooks.forEach(comp => {
      components[`hook:${comp.name}`] = comp;
    });

    // Parse ~/.claude/mcp.json to extract MCP servers
    const mcpConfigPath = expandTilde('~/.claude/mcp.json');
    const mcpServers = await this.detectMCPServers(mcpConfigPath);
    mcpServers.forEach(comp => {
      components[`mcp-server:${comp.name}`] = comp;
    });

    return {
      ecosystem: 'claude-code',
      found: Object.keys(components).length > 0,
      components,
      scanPaths
    };
  }

  // detectDirectory is now imported from utils/detector-utils.ts

  /**
   * Parses ~/.claude/mcp.json to extract MCP server definitions.
   * Reads the mcpServers object and creates ComponentInfo entries for each server.
   *
   * @private
   * @param {string} configPath - Path to mcp.json file
   * @returns {Promise<ComponentInfo[]>} Array of detected MCP servers
   *
   * @example
   * Given mcp.json:
   * ```json
   * {
   *   "mcpServers": {
   *     "filesystem": {
   *       "command": "npx",
   *       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
   *     }
   *   }
   * }
   * ```
   *
   * Returns:
   * ```typescript
   * [
   *   {
   *     name: 'filesystem',
   *     path: '/Users/username/.claude/mcp.json',
   *     type: 'mcp-server'
   *   }
   * ]
   * ```
   */
  private async detectMCPServers(configPath: string): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      // MCP config format: { "mcpServers": { "server-name": { ... } } }
      if (config.mcpServers && typeof config.mcpServers === 'object') {
        for (const [serverName] of Object.entries(config.mcpServers)) {
          components.push({
            name: serverName,
            path: configPath,
            type: 'mcp-server'
          });
        }
      }
    } catch (error) {
      // File doesn't exist or invalid JSON - return empty array
      return [];
    }

    return components;
  }
}
