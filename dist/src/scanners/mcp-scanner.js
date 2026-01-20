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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPScanner = void 0;
const fs = __importStar(require("fs"));
const base_scanner_1 = require("./base-scanner");
/**
 * MCP Server Scanner - specialized scanner for Model Context Protocol (MCP) servers
 * Detects network exfiltration, command injection, and unsafe configurations
 */
// MCP-specific security patterns
const MCP_PATTERNS = [
    {
        id: 'MCP_HTTP_EXFIL',
        pattern: /(?:url|endpoint|host)["']\s*:\s*["']https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
        description: 'MCP server configured with hardcoded IP address (potential exfiltration)'
    },
    {
        id: 'MCP_COMMAND_INJECTION',
        pattern: /(?:command|args)["']\s*:\s*["'][^"']*(?:\$\{|`|\||;|&&)/,
        description: 'MCP stdio command contains potential command injection vectors'
    },
    {
        id: 'MCP_UNTRUSTED_URL',
        pattern: /(?:url|endpoint)["']\s*:\s*["']https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^"']+/i,
        description: 'MCP server URL points to non-localhost endpoint (security risk)'
    },
    {
        id: 'MCP_ENV_DANGER',
        pattern: /(?:env|environment)["']\s*:\s*\{[^}]*(?:AWS_SECRET|ANTHROPIC_API_KEY|OPENAI_API_KEY|API_SECRET|PRIVATE_KEY)[^}]*\}/i,
        description: 'MCP server environment configuration may expose sensitive credentials'
    }
];
class MCPScanner extends base_scanner_1.BaseScanner {
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
        // Add context-aware validation
        for (const server of servers) {
            // Check for command injection in stdio servers
            if (server.type === 'stdio' && server.args) {
                for (const arg of server.args) {
                    if (/\$\{|`|\||;|&&/.test(arg)) {
                        baseResult.matches.push({
                            id: 'MCP_COMMAND_INJECTION',
                            description: `MCP server "${server.name}" has potentially unsafe command argument: ${arg}`,
                            line: 0, // Line number not available from JSON parsing
                            match: `args: [${server.args.join(', ')}]`
                        });
                    }
                }
            }
            // Check for HTTP servers pointing to external IPs
            if (server.url && /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(server.url)) {
                baseResult.matches.push({
                    id: 'MCP_HTTP_EXFIL',
                    description: `MCP server "${server.name}" connects to hardcoded IP: ${server.url}`,
                    line: 0,
                    match: `url: ${server.url}`
                });
            }
            // Check for sensitive environment variables
            if (server.env) {
                const sensitiveKeys = Object.keys(server.env).filter(key => /AWS_SECRET|ANTHROPIC_API_KEY|OPENAI_API_KEY|API_SECRET|PRIVATE_KEY/i.test(key));
                if (sensitiveKeys.length > 0) {
                    baseResult.matches.push({
                        id: 'MCP_ENV_DANGER',
                        description: `MCP server "${server.name}" exposes sensitive environment variables: ${sensitiveKeys.join(', ')}`,
                        line: 0,
                        match: `env: { ${sensitiveKeys.join(', ')} }`
                    });
                }
            }
        }
        return baseResult;
    }
}
exports.MCPScanner = MCPScanner;
