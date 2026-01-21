import * as fs from 'fs';
import { BaseScanner } from './base-scanner.js';
const MCP_PATTERNS = [
    {
        id: 'MCP_HTTP_EXFIL',
        category: 'EXFILTRATION',
        severity: 'critical',
        pattern: /(?:url|endpoint|host)["']\s*:\s*["']https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
        description: 'MCP server connects to hardcoded IP'
    },
    {
        id: 'MCP_COMMAND_INJECTION',
        category: 'EXFILTRATION',
        severity: 'critical',
        pattern: /(?:command|args)["']\s*:\s*["'][^"']*(?:\$\{|`|\||;|&&)/,
        description: 'MCP command contains injection vectors'
    },
    {
        id: 'MCP_ENV_DANGER',
        category: 'SENSITIVE_ACCESS',
        severity: 'high',
        pattern: /(?:env|environment)["']\s*:\s*\{[^}]*(?:AWS_SECRET|ANTHROPIC_API_KEY|OPENAI_API_KEY|API_SECRET|PRIVATE_KEY)[^}]*\}/i,
        description: 'MCP exposes sensitive credentials in env'
    }
];
export class MCPScanner extends BaseScanner {
    constructor() {
        super();
        // Add MCP-specific patterns to the base patterns
        this.patterns = [...this.patterns, ...MCP_PATTERNS];
    }
    /**
     * Extract MCP server definitions from mcp.json configuration file
     * @param configPath Path to mcp.json file
     * @returns Array of parsed MCP server configurations
     */
    async extractMCPServers(configPath) {
        try {
            const content = await fs.promises.readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            const servers = [];
            // MCP config format: { "mcpServers": { "server-name": { ... } } }
            if (config.mcpServers && typeof config.mcpServers === 'object') {
                for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
                    const server = serverConfig;
                    // Determine server type based on configuration
                    let type = 'stdio';
                    if (server.url) {
                        type = server.transport === 'sse' ? 'sse' : 'http';
                    }
                    servers.push({
                        name,
                        type,
                        command: server.command,
                        args: server.args,
                        env: server.env,
                        url: server.url
                    });
                }
            }
            return servers;
        }
        catch (error) {
            // File doesn't exist or invalid JSON - return empty array
            return [];
        }
    }
    /**
     * Scan an MCP configuration file for security issues
     * @param filePath Path to the MCP configuration file
     * @returns Scan results with detected issues
     */
    async scanMCPConfig(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        // First run standard pattern matching
        const baseResult = this.scanFile(filePath, content);
        // Then extract and validate MCP servers for deeper analysis
        const servers = await this.extractMCPServers(filePath);
        for (const server of servers) {
            if (server.type === 'stdio' && server.args) {
                for (const arg of server.args) {
                    if (/\$\{|`|\||;|&&/.test(arg)) {
                        baseResult.matches.push({
                            id: 'MCP_COMMAND_INJECTION',
                            category: 'EXFILTRATION',
                            severity: 'critical',
                            description: `MCP server "${server.name}" has unsafe command argument`,
                            line: 0,
                            match: `args: [${server.args.join(', ')}]`,
                            contextBefore: [],
                            contextAfter: []
                        });
                    }
                }
            }
            if (server.url && /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(server.url)) {
                baseResult.matches.push({
                    id: 'MCP_HTTP_EXFIL',
                    category: 'EXFILTRATION',
                    severity: 'critical',
                    description: `MCP server "${server.name}" connects to hardcoded IP`,
                    line: 0,
                    match: `url: ${server.url}`,
                    contextBefore: [],
                    contextAfter: []
                });
            }
            if (server.env) {
                const sensitiveKeys = Object.keys(server.env).filter(key => /AWS_SECRET|ANTHROPIC_API_KEY|OPENAI_API_KEY|API_SECRET|PRIVATE_KEY/i.test(key));
                if (sensitiveKeys.length > 0) {
                    baseResult.matches.push({
                        id: 'MCP_ENV_DANGER',
                        category: 'SENSITIVE_ACCESS',
                        severity: 'high',
                        description: `MCP server "${server.name}" exposes sensitive env vars`,
                        line: 0,
                        match: `env: { ${sensitiveKeys.join(', ')} }`,
                        contextBefore: [],
                        contextAfter: []
                    });
                }
            }
        }
        return baseResult;
    }
}
