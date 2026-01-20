[PRD]
# PRD: AI Tool Guard Autodetection System

## Overview

Add autodetection capabilities to AI Tool Guard to automatically discover and scan AI development tools (Claude Code, OpenCode, Copilot, Codex, Gemini) installed on the system. This eliminates manual path specification and provides comprehensive security coverage across the entire AI tool ecosystem with component-aware scanning.

## Goals

- Enable dual-mode operation: automatic "scan everything" and interactive "review then scan"
- Detect AI tools across 5+ ecosystems with full component coverage (plugins, MCP servers, skills, hooks, configs)
- Implement smart discovery using standard paths and `$PATH` scanning
- Apply component-specific security patterns (MCP, hooks, skills, configs)
- Present results grouped by ecosystem for clear, actionable output
- Maintain cross-platform compatibility with Unix-like systems as primary focus

## Quality Gates

These commands must pass for every user story:
- `npm run build` - Build the TypeScript project
- `npm run test` - Run all tests

## User Stories

### Core Detection System

#### US-001: Define core detection interfaces
**Description:** As a developer, I want well-defined TypeScript interfaces for the detection system so that all detectors follow a consistent contract.

**Acceptance Criteria:**
- [ ] Create `src/detectors/base-detector.ts` with `AIToolDetector` interface
- [ ] Interface includes: `name`, `detect()`, `getPaths()`, `checkPATH()`
- [ ] Define `DetectionResult` interface with ecosystem, found flag, components object, scanPaths
- [ ] Define `ComponentInfo` interface with name, path, optional type field
- [ ] All interfaces properly exported and documented with TSDoc comments

#### US-002: Implement AutoDetector orchestrator
**Description:** As a developer, I want a central orchestrator that loads and runs all detectors in parallel.

**Acceptance Criteria:**
- [ ] Create `src/autodetect.ts` with `AutoDetector` class
- [ ] Implement `loadDetectors()` to dynamically import all detector modules from `src/detectors/`
- [ ] Implement `detectAll()` to run detectors in parallel using `Promise.all()`
- [ ] Return `Map<string, DetectionResult>` with only found ecosystems
- [ ] Add error handling to continue if one detector fails
- [ ] Add timeout protection (30s per detector) using `Promise.race()`

#### US-003: Create detector registry with auto-loading
**Description:** As a developer, I want detectors to be automatically discovered so that adding new ecosystems requires minimal boilerplate.

**Acceptance Criteria:**
- [ ] Create `src/detectors/detector-registry.ts`
- [ ] Implement dynamic import of all `*-detector.ts` files in detectors directory
- [ ] Export `getAllDetectors(): AIToolDetector[]` function
- [ ] Handle module loading errors gracefully with warnings
- [ ] Add validation that each detector implements the interface correctly

### Detector Implementations

#### US-004: Implement Claude Code detector
**Description:** As a user, I want the tool to detect my Claude Code installation so that all plugins, skills, hooks, and MCP servers are scanned.

**Acceptance Criteria:**
- [ ] Create `src/detectors/claude-code-detector.ts` implementing `AIToolDetector`
- [ ] `getPaths()` returns `~/.claude/` and `~/.config/claude/`
- [ ] `checkPATH()` scans for `claude` executable and resolves symlinks
- [ ] `detect()` finds plugins in `~/.claude/plugins/`
- [ ] Parse `~/.claude/mcp.json` to extract MCP server definitions
- [ ] Detect skills in `~/.claude/skills/`
- [ ] Detect hooks in `~/.claude/hooks/`
- [ ] Return all found components categorized by type

#### US-005: Implement OpenCode detector
**Description:** As a user, I want the tool to detect OpenCode installations for security scanning.

**Acceptance Criteria:**
- [ ] Create `src/detectors/opencode-detector.ts` implementing `AIToolDetector`
- [ ] `getPaths()` returns `~/.config/opencode/` and `~/.opencode/`
- [ ] `checkPATH()` scans for `opencode` executable
- [ ] `detect()` finds plugins and config files
- [ ] Handle missing directories gracefully

#### US-006: Implement GitHub Copilot detector
**Description:** As a user, I want the tool to detect GitHub Copilot extensions in VS Code and Cursor.

**Acceptance Criteria:**
- [ ] Create `src/detectors/copilot-detector.ts` implementing `AIToolDetector`
- [ ] `getPaths()` returns `~/.vscode/extensions/` and `~/.cursor/extensions/`
- [ ] Detect `github.copilot-*` extension directories
- [ ] Parse `~/.config/Code/User/settings.json` for Copilot config
- [ ] Extract extension version and metadata

#### US-007: Implement Codex CLI detector
**Description:** As a user, I want the tool to detect Codex CLI installations.

**Acceptance Criteria:**
- [ ] Create `src/detectors/codex-detector.ts` implementing `AIToolDetector`
- [ ] `checkPATH()` scans for `codex` and `codex-*` executables
- [ ] Resolve symlinks to find installation directory
- [ ] Detect config files in standard locations
- [ ] Extract version information when available

#### US-008: Implement Gemini integration detector
**Description:** As a user, I want the tool to detect Google AI Studio/Gemini integrations.

**Acceptance Criteria:**
- [ ] Create `src/detectors/gemini-detector.ts` implementing `AIToolDetector`
- [ ] Define standard paths for Gemini configs
- [ ] Detect integration files and configurations
- [ ] Handle multiple integration types (VS Code, standalone)

### Component-Aware Scanners

#### US-009: Refactor existing scanner as BaseScanner
**Description:** As a developer, I want the current scanner.ts refactored into a base class for inheritance.

**Acceptance Criteria:**
- [ ] Rename `src/scanner.ts` to `src/scanners/base-scanner.ts`
- [ ] Convert `SecurityScanner` to `BaseScanner` class
- [ ] Make `patterns` array protected for subclass access
- [ ] Keep existing patterns and methods intact
- [ ] Update imports in `src/index.ts`

#### US-010: Implement MCP Server scanner
**Description:** As a security analyst, I want specialized scanning for MCP servers to catch network exfiltration and command injection.

**Acceptance Criteria:**
- [ ] Create `src/scanners/mcp-scanner.ts` extending `BaseScanner`
- [ ] Add pattern: `MCP_HTTP_EXFIL` for HTTP requests to IP addresses
- [ ] Add pattern: `MCP_COMMAND_INJECTION` for command injection in stdio args
- [ ] Add pattern: `MCP_UNTRUSTED_URL` for non-localhost HTTP URLs
- [ ] Add pattern: `MCP_ENV_DANGER` for unsafe environment variable usage
- [ ] Implement `extractMCPServers(configPath)` to parse mcp.json

#### US-011: Implement Hook scanner
**Description:** As a security analyst, I want specialized scanning for hooks to catch dangerous shell commands and credential access.

**Acceptance Criteria:**
- [ ] Create `src/scanners/hook-scanner.ts` extending `BaseScanner`
- [ ] Add pattern: `HOOK_SHELL_DANGER` for dangerous commands (rm -rf, dd, mkfs, format)
- [ ] Add pattern: `HOOK_FILE_UPLOAD` for file uploads (curl -F, scp)
- [ ] Add pattern: `HOOK_CRED_ACCESS` for credential file access (~/.aws, ~/.ssh)
- [ ] Add pattern: `HOOK_BACKGROUND_SPAWN` for background process spawning

#### US-012: Implement Skill/Agent scanner
**Description:** As a security analyst, I want specialized scanning for skills to catch autonomous actions and stealth instructions.

**Acceptance Criteria:**
- [ ] Create `src/scanners/skill-scanner.ts` extending `BaseScanner`
- [ ] Inherit base prompt injection patterns
- [ ] Add pattern: `SKILL_AUTO_ACTION` for actions without user consent
- [ ] Add pattern: `SKILL_STEALTH_MODE` for hiding behavior from users
- [ ] Add pattern: `SKILL_SYSTEM_MODIFY` for system-level config changes

#### US-013: Implement Config scanner
**Description:** As a security analyst, I want specialized scanning for config files to catch hardcoded secrets and dangerous permissions.

**Acceptance Criteria:**
- [ ] Create `src/scanners/config-scanner.ts` extending `BaseScanner`
- [ ] Add pattern: `CONFIG_API_KEY` for hardcoded API keys/secrets (20+ chars)
- [ ] Add pattern: `CONFIG_ENV_EXFIL` for accessing sensitive env vars (AWS, ANTHROPIC, OPENAI)
- [ ] Add pattern: `CONFIG_INSECURE_PROTOCOL` for HTTP instead of HTTPS
- [ ] Add pattern: `CONFIG_DANGEROUS_PERMS` for overly broad permissions

#### US-014: Create scanner factory
**Description:** As a developer, I want a factory to select the appropriate scanner based on component type and file path.

**Acceptance Criteria:**
- [ ] Create `src/scanners/scanner-factory.ts`
- [ ] Implement `selectScanner(componentType, filePath): BaseScanner`
- [ ] Return `MCPScanner` for componentType='mcpServer' or path includes 'mcp'
- [ ] Return `HookScanner` for componentType='hook' or path includes 'hooks/'
- [ ] Return `SkillScanner` for componentType='skill' or path includes 'skills/'
- [ ] Return `ConfigScanner` for .json files or path includes 'config'
- [ ] Fallback to `BaseScanner` for unknown types

### CLI Interface & Output

#### US-015: Add CLI argument parsing
**Description:** As a user, I want new CLI flags for autodetection modes.

**Acceptance Criteria:**
- [ ] Install `commander` package for robust CLI parsing
- [ ] Add `--auto-detect` / `-a` flag for automatic mode
- [ ] Add `--detect-interactive` / `-i` flag for interactive mode
- [ ] Add `--detect <ecosystem>` for single ecosystem detection
- [ ] Add `--type <component-type>` filter for specific components
- [ ] Update help text with new options
- [ ] Maintain backwards compatibility with existing `ai-tool-guard <path>` usage

#### US-016: Implement automatic detection mode
**Description:** As a user, I want to run one command that detects and scans all AI tools automatically.

**Acceptance Criteria:**
- [ ] Implement automatic mode in `src/cli.ts` when `-a` flag is used
- [ ] Call `AutoDetector.detectAll()` to find ecosystems
- [ ] Display "Detecting..." progress indicator
- [ ] Show summary: "Found X ecosystems, Y components"
- [ ] Call scanning phase for all detected components
- [ ] Display progress bars for each ecosystem scan
- [ ] Output results grouped by ecosystem with emoji indicators
- [ ] Exit code 0 if no issues, 1 if issues found

#### US-017: Implement interactive detection mode
**Description:** As a user, I want to review what was detected before choosing what to scan.

**Acceptance Criteria:**
- [ ] Install `prompts` package for interactive CLI prompts
- [ ] Implement interactive mode when `-i` flag is used
- [ ] Display detection results grouped by ecosystem with component counts
- [ ] Show "Scan all detected tools? (Y/n)" prompt
- [ ] If 'n', show multi-select list with ecosystems as checkboxes
- [ ] User can select/deselect ecosystems with arrow keys and space
- [ ] Scan only selected ecosystems
- [ ] Display results in same format as automatic mode

#### US-018: Implement ecosystem filtering
**Description:** As a user, I want to detect and scan only specific ecosystems or component types.

**Acceptance Criteria:**
- [ ] `--detect claude-code` runs only Claude Code detector
- [ ] `--detect copilot` runs only Copilot detector
- [ ] `--auto-detect --type mcp-servers` scans only MCP server components
- [ ] `--auto-detect --type hooks` scans only hook components
- [ ] Display helpful error if ecosystem name is invalid
- [ ] Suggest similar ecosystem names for typos (Levenshtein distance)

#### US-019: Create grouped output formatter
**Description:** As a user, I want scan results grouped by ecosystem for easy interpretation.

**Acceptance Criteria:**
- [ ] Create `src/formatters/grouped-output.ts`
- [ ] Display ecosystem headers with separator lines and emoji
- [ ] Show component type and count under each ecosystem
- [ ] Display issue count and files affected
- [ ] Show sample code snippets (truncated to 100 chars)
- [ ] Use color coding: green for clean, yellow for warnings, red for critical
- [ ] Display final summary with total issues across all ecosystems

### Scanning Orchestration

#### US-020: Implement ecosystem scanning
**Description:** As a developer, I want to scan all components in a detected ecosystem with appropriate scanners.

**Acceptance Criteria:**
- [ ] Implement `AutoDetector.scanDetected(results)` method
- [ ] For each ecosystem, iterate through component types
- [ ] Use `scanner-factory` to select appropriate scanner per component
- [ ] Call scanner on each component's path
- [ ] Collect results into `EcosystemReport` structure
- [ ] Calculate total issues per ecosystem
- [ ] Return `ScanReport` with all ecosystem reports

#### US-021: Add error handling and safety
**Description:** As a user, I want the scanner to handle errors gracefully without crashing.

**Acceptance Criteria:**
- [ ] Skip directories without read permissions, log warning
- [ ] Skip files > 10MB, display warning with file size
- [ ] Continue with other detectors if one fails
- [ ] Track visited paths to prevent symlink loops
- [ ] Use existing binary file check before text scan
- [ ] Display error summary at end if any detectors failed

### Cross-Platform Support (Unix-like Focus)

#### US-022: Implement Unix-like path handling
**Description:** As a developer, I want robust path handling for macOS and Linux.

**Acceptance Criteria:**
- [ ] Use `os.homedir()` for home directory on macOS/Linux
- [ ] Use `path.join()` for all path construction
- [ ] Handle `~` expansion in paths
- [ ] Split `PATH` environment variable on `:` character
- [ ] Resolve symlinks with `fs.promises.realpath()`
- [ ] Test on both macOS and Linux in CI

#### US-023: Windows support (follow-up)
**Description:** As a Windows user, I want autodetection to work on my system.

**Acceptance Criteria:**
- [ ] Use `%USERPROFILE%` for home directory on Windows
- [ ] Handle both `/` and `\` path separators
- [ ] Split `PATH` environment variable on `;` character
- [ ] Use Windows-specific default paths (`%APPDATA%`, etc.)
- [ ] Test on Windows in CI

## Functional Requirements

- FR-1: The system must detect AI tools in standard installation locations without user input
- FR-2: The system must scan `$PATH` environment variable for AI CLI executables
- FR-3: The system must parse MCP config files to extract server definitions
- FR-4: The system must apply component-specific security patterns based on file type
- FR-5: The system must present results grouped by ecosystem with component counts
- FR-6: The system must support both automatic and interactive modes via CLI flags
- FR-7: The system must maintain backwards compatibility with manual path specification
- FR-8: The system must handle permission errors and large files gracefully
- FR-9: The system must resolve symlinks to find actual installation directories
- FR-10: The system must support filtering by ecosystem or component type
- FR-11: All detectors must complete within 30 seconds or timeout
- FR-12: The system must run detectors in parallel for performance

## Non-Goals (Out of Scope)

- Runtime monitoring of actively running MCP servers
- Numerical risk scoring for findings
- Automated remediation or fix suggestions
- Allowlist management for known-safe patterns
- CI/CD integration (GitHub Actions)
- Differential scanning (only changed files)
- Detection of non-standard AI tool locations beyond PATH
- Custom detector plugins from users
- JSON output format
- Persistent user preferences in interactive mode
- Version mismatch detection across installation methods
- Docker/containerized AI tool detection

## Technical Considerations

### Architecture
- Modular detector architecture allows easy addition of new ecosystems
- Component-aware scanners are reusable across ecosystems
- Scanner factory pattern enables flexible scanner selection
- Parallel detector execution improves performance

### Dependencies
- **New**: `commander` for CLI parsing, `prompts` for interactive mode
- **Existing**: `fdir`, `isbinaryfile`, TypeScript stdlib

### Error Handling
- Graceful degradation: continue if one detector fails
- Timeout protection prevents hung detectors
- Permission errors don't crash the scan
- Symlink loop detection

### Performance
- Parallel detector execution
- Reuse existing file walker and binary checks
- 30s timeout per detector
- Skip files > 10MB

## Success Metrics

- Detects 95%+ of installed AI tools without manual configuration
- Zero false negatives on component-specific threats (MCP exfiltration, hook dangers)
- Interactive mode provides clear value for users wanting control
- Average scan time < 5 seconds for typical developer setup (3 ecosystems, 30 components)
- Cross-platform support covers 90%+ of users (Unix-like primary focus)

## Open Questions

None - all design questions resolved.

**Future Enhancements (deferred):**
- JSON output flag for CI/CD integration
- Persistent user preferences in interactive mode
- Version mismatch detection across installation methods
- Docker/containerized AI tool detection

[/PRD]
