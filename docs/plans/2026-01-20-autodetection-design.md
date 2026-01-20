# AI Tool Guard: Autodetection System Design

**Date:** 2026-01-20
**Status:** Approved
**Author:** Design collaboration with user

## Overview

Add autodetection capabilities to AI Tool Guard to automatically discover and scan AI development tools installed on the system. This eliminates manual path specification and provides comprehensive security coverage across the entire AI tool ecosystem.

## Goals

1. **Dual-mode operation**: Support both automatic "scan everything" and interactive "review then scan" modes
2. **Broad ecosystem support**: Detect Claude Code, OpenCode, Codex, Gemini, GitHub Copilot, and other MCP-based tools
3. **Full component coverage**: Find plugins, MCP servers, skills, agents, hooks, and configuration files
4. **Smart discovery**: Check standard paths AND scan `$PATH` for CLI installations
5. **Component-aware scanning**: Apply specialized security checks based on component type
6. **Grouped presentation**: Organize results by ecosystem for clear, actionable output

## Supported AI Tool Ecosystems

| Ecosystem | Detection Targets |
|-----------|------------------|
| **Claude Code** | Plugins, MCP servers, skills, hooks, config files in `~/.claude/` |
| **OpenCode** | Plugins and configs in `~/.config/opencode/` or `~/.opencode/` |
| **GitHub Copilot** | VS Code/Cursor extensions and settings |
| **Codex** | CLI installations and config files |
| **Gemini** | Google AI Studio integrations and configs |
| **Generic MCP** | Any tool with MCP config files |

## Architecture

### Directory Structure

```
src/
  detectors/
    base-detector.ts          # Abstract AIToolDetector interface
    claude-code-detector.ts   # Claude Code ecosystem detection
    opencode-detector.ts      # OpenCode detection
    copilot-detector.ts       # GitHub Copilot detection
    codex-detector.ts         # Codex CLI detection
    gemini-detector.ts        # Gemini integration detection
    detector-registry.ts      # Auto-loads all detectors

  scanners/
    base-scanner.ts          # Core pattern matching (existing scanner.ts)
    mcp-scanner.ts          # MCP server-specific security checks
    hook-scanner.ts         # Hook-specific patterns
    skill-scanner.ts        # Skill/agent scanning
    config-scanner.ts       # Config file analysis
    scanner-factory.ts      # Selects appropriate scanner

  autodetect.ts             # Main orchestrator
  cli.ts                    # Enhanced CLI with new flags
```

### Core Interfaces

```typescript
interface AIToolDetector {
  name: string;                    // e.g., "Claude Code"
  detect(): Promise<DetectionResult>;
  getPaths(): string[];            // Standard install paths
  checkPATH(): Promise<string[]>;  // Find CLIs in $PATH
}

interface DetectionResult {
  ecosystem: string;
  found: boolean;
  components: {
    plugins: ComponentInfo[];
    mcpServers: ComponentInfo[];
    skills: ComponentInfo[];
    hooks: ComponentInfo[];
    configs: ComponentInfo[];
  };
  scanPaths: string[];  // All paths to scan
}

interface ComponentInfo {
  name: string;
  path: string;
  type?: string;  // e.g., 'stdio', 'http' for MCP servers
}

interface ScanReport {
  ecosystems: EcosystemReport[];
}

interface EcosystemReport {
  ecosystem: string;
  components: ComponentScanResult[];
  totalIssues: number;
}
```

## Detection Strategy

### 1. Standard Path Detection

Each detector defines known installation locations:

**Claude Code:**
- `~/.claude/plugins`
- `~/.claude/skills`
- `~/.claude/hooks`
- `~/.claude/mcp.json`
- `~/.config/claude/`

**OpenCode:**
- `~/.config/opencode/`
- `~/.opencode/`

**VS Code/Copilot:**
- `~/.vscode/extensions/github.copilot-*`
- `~/.config/Code/User/settings.json`

**Cursor:**
- `~/.cursor/extensions`

### 2. PATH Scanning

Scan `process.env.PATH` for AI CLI executables:
- Match patterns: `claude`, `claude-*`, `codex`, `codex-*`, `copilot-cli`, `gh-copilot`
- Resolve symlinks to find actual installation directories
- Extract version and metadata when possible

### 3. Config File Parsing

Parse configuration files to discover additional components:
- `~/.claude/mcp.json` → Extract MCP server definitions (stdio commands, HTTP URLs)
- VS Code `settings.json` → Find extension paths and MCP configurations
- `package.json` → Detect local dev dependencies
- Follow referenced paths to scan actual implementation files

## Component-Aware Scanning

Different component types get specialized security patterns:

### MCP Server Scanner

**Additional patterns:**
- Network exfiltration to external IPs
- Command injection in stdio args (`args: ["${...}"]`)
- Untrusted server URLs
- Unsafe environment variable usage in commands

```typescript
{ id: 'MCP_HTTP_EXFIL',
  pattern: /http\.request.*\d{1,3}\.\d{1,3}/,
  description: 'MCP server making HTTP request to IP address' }
```

### Hook Scanner

**Additional patterns:**
- Dangerous shell commands (`rm -rf`, `dd`, `mkfs`)
- File upload operations (`curl -F`, `scp`)
- Credential file access (`~/.aws/credentials`, `~/.ssh/id_*`)
- Background process spawning

```typescript
{ id: 'HOOK_SHELL_DANGER',
  pattern: /rm -rf|dd if=|mkfs|format/,
  description: 'Dangerous shell command in hook' }
```

### Skill/Agent Scanner

**Inherits base patterns plus:**
- Autonomous actions without user consent
- Instructions to hide behavior from users
- Attempts to modify system-level configurations

```typescript
{ id: 'SKILL_AUTO_ACTION',
  pattern: /automatically.*execute|run without.*ask/,
  description: 'Skill may perform actions without user consent' }
```

### Config Scanner

**Additional patterns:**
- Hardcoded API keys and secrets
- Suspicious environment variable access
- Insecure protocol usage (HTTP instead of HTTPS)
- Dangerous permission grants

```typescript
{ id: 'CONFIG_API_KEY',
  pattern: /(api[_-]?key|apikey|secret)["']?\s*[:=]\s*["'][a-zA-Z0-9]{20,}/,
  description: 'Hardcoded API key or secret detected' }
```

## CLI Interface

### New Commands

```bash
# Automatic mode - detect and scan everything
ai-tool-guard --auto-detect
ai-tool-guard -a

# Interactive mode - show detection results, let user choose
ai-tool-guard --detect-interactive
ai-tool-guard -i

# Detect specific ecosystem only
ai-tool-guard --detect claude-code
ai-tool-guard --detect copilot

# Filter by component type
ai-tool-guard --auto-detect --type mcp-servers
ai-tool-guard --auto-detect --type hooks
```

### Automatic Mode Output

```
🔍 AI Tool Guard: Auto-detecting and scanning AI tools...

Detecting... ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%

Found 3 ecosystems, 34 components

Scanning Claude Code (20 files)... ━━━━━━━━━━━ 100%
Scanning GitHub Copilot (3 files)... ━━━━━━━━━━━ 100%
Scanning Codex CLI (2 files)... ━━━━━━━━━━━ 100%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Claude Code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Found 2 issues in 1 file

  📄 hooks/post-edit.sh
    [HOOK_SHELL_DANGER] Line 23: Dangerous shell command in hook
    Code: "rm -rf $TEMP_DIR/*"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 GitHub Copilot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ No suspicious patterns found

🚨 Scan complete. Found 2 potential issues across 3 ecosystems.
```

### Interactive Mode Flow

```
🔍 AI Tool Guard: Auto-detecting AI tools...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Claude Code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Found at: ~/.claude/
  📊 Components:
    • 12 plugins
    • 3 MCP servers
    • 5 skills
    • 2 hooks
    • 8 config files

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 GitHub Copilot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Found at: ~/.vscode/extensions/github.copilot-*
  📊 Components:
    • 1 extension
    • 2 config files

Summary: Found 2 AI tool ecosystems with 33 total components

? Scan all detected tools? (Y/n) _
```

## Implementation Flow

### 1. Detection Phase

```typescript
class AutoDetector {
  async detectAll(): Promise<Map<string, DetectionResult>> {
    // Load all detector modules from detectors/
    this.loadDetectors();

    // Run all detectors in parallel
    const results = await Promise.all(
      this.detectors.map(d => d.detect())
    );

    // Filter to ecosystems that were found
    return new Map(
      results
        .filter(r => r.found)
        .map(r => [r.ecosystem, r])
    );
  }
}
```

### 2. Scanning Phase

```typescript
async scanDetected(results: Map<string, DetectionResult>): Promise<ScanReport> {
  const report: ScanReport = { ecosystems: [] };

  for (const [ecosystem, detection] of results) {
    // For each component type, select appropriate scanner
    const ecosystemReport = await this.scanEcosystem(detection);
    report.ecosystems.push(ecosystemReport);
  }

  return report;
}

private selectScanner(componentType: string, filePath: string): BaseScanner {
  if (componentType === 'mcpServer' || filePath.includes('mcp')) {
    return new MCPScanner();
  }
  if (componentType === 'hook' || filePath.includes('hooks/')) {
    return new HookScanner();
  }
  if (componentType === 'skill' || filePath.includes('skills/')) {
    return new SkillScanner();
  }
  if (filePath.endsWith('.json') || filePath.includes('config')) {
    return new ConfigScanner();
  }
  return new BaseScanner(); // Fallback to general patterns
}
```

### 3. Example Detector Implementation

```typescript
class ClaudeCodeDetector implements AIToolDetector {
  name = 'Claude Code';

  getPaths(): string[] {
    const home = os.homedir();
    return [
      path.join(home, '.claude'),
      path.join(home, '.config', 'claude')
    ];
  }

  async checkPATH(): Promise<string[]> {
    const pathDirs = process.env.PATH?.split(':') || [];
    const found = [];

    for (const dir of pathDirs) {
      const claudePath = path.join(dir, 'claude');
      if (await this.fileExists(claudePath)) {
        // Resolve symlink to find actual installation
        const realPath = await fs.promises.realpath(claudePath);
        found.push(path.dirname(realPath));
      }
    }

    return found;
  }

  async detect(): Promise<DetectionResult> {
    const result: DetectionResult = {
      ecosystem: this.name,
      found: false,
      components: {
        plugins: [],
        mcpServers: [],
        skills: [],
        hooks: [],
        configs: []
      },
      scanPaths: []
    };

    // Check standard paths
    for (const basePath of this.getPaths()) {
      if (await this.dirExists(basePath)) {
        result.found = true;

        // Detect each component type
        await this.detectPlugins(basePath, result);
        await this.detectMCPServers(basePath, result);
        await this.detectSkills(basePath, result);
        await this.detectHooks(basePath, result);

        result.scanPaths.push(basePath);
      }
    }

    // Check PATH for CLI
    const pathInstalls = await this.checkPATH();
    result.scanPaths.push(...pathInstalls);

    if (pathInstalls.length > 0) {
      result.found = true;
    }

    return result;
  }

  private async detectMCPServers(basePath: string, result: DetectionResult) {
    const mcpConfig = path.join(basePath, 'mcp.json');
    if (await this.fileExists(mcpConfig)) {
      // Parse config to extract server definitions
      const content = await fs.promises.readFile(mcpConfig, 'utf-8');
      const config = JSON.parse(content);

      result.components.mcpServers = Object.entries(config.mcpServers || {})
        .map(([name, server]: any) => ({
          name,
          path: server.command || server.url,
          type: server.command ? 'stdio' : 'http'
        }));

      result.components.configs.push({
        path: mcpConfig,
        name: 'mcp.json'
      });
    }
  }
}
```

## Error Handling & Safety

- **Permission errors**: Skip inaccessible directories, log warning
- **Large files**: Skip files > 10MB, warn user
- **Detector failures**: Continue with other detectors if one fails
- **Timeout protection**: 30s timeout per detector
- **Symlink loops**: Track visited paths to prevent infinite loops
- **Binary files**: Fast binary check before attempting text scan

## Cross-Platform Considerations

### Path Handling

- **macOS/Linux**: `~/.claude/`, `/usr/local/bin/`
- **Windows**: `%USERPROFILE%\.claude\`, `%APPDATA%\`
- Use `os.homedir()` and `path.join()` for all path construction
- Handle both `/` and `\` separators

### PATH Parsing

- **macOS/Linux**: Split on `:`
- **Windows**: Split on `;`
- Use `process.env.PATH` for universal access

## Future Enhancements (Out of Scope)

- **Runtime monitoring**: Detect actively running MCP servers and agents
- **Risk scoring**: Assign numerical risk scores to findings
- **Remediation suggestions**: Offer fixes for common issues
- **Allowlist management**: Let users mark known-safe patterns
- **CI/CD integration**: GitHub Action for automated scanning
- **Differential scanning**: Only scan changed files since last run

## Success Metrics

- Detects 95%+ of installed AI tools without manual configuration
- Zero false negatives on component-specific threats (MCP exfiltration, hook dangers)
- Interactive mode used by 60%+ of users for better control
- Average scan time < 5 seconds for typical developer setup

## Migration Path

This is a pure addition - existing `ai-tool-guard <path>` usage remains unchanged. Users can:
1. Continue using manual path specification
2. Opt-in to autodetection with new flags
3. Mix both approaches (auto-detect + manual paths)

## Testing Strategy

- **Unit tests**: Each detector with mocked filesystem
- **Integration tests**: Full detection flow with fixture directories
- **Scanner tests**: Component-specific pattern matching
- **E2E tests**: Real-world scenarios with actual tool installations
- **Cross-platform tests**: Run on macOS, Linux, Windows in CI

## Dependencies

**New:**
- None - uses existing Node.js stdlib and current dependencies

**Updated:**
- Enhanced CLI argument parsing (consider adding `commander` or `yargs`)
- Interactive prompts (consider adding `inquirer` or `prompts`)

## Timeline Estimate

- **Week 1**: Core detection system + Claude Code detector
- **Week 2**: Component-aware scanners + remaining detectors
- **Week 3**: CLI interface + interactive mode
- **Week 4**: Testing, documentation, polish
