# 🛡️ AI Tool Guard

A universal security scanner for AI CLI extensions, skills, and agents. Detects tool poisoning, data exfiltration, and malicious patterns in `Claude Code`, `OpenCode`, and other MCP-based environments.

## 🚀 Installation

```bash
npm install -g ai-tool-guard
```

**Local development (not published to npm):**
```bash
npm install
npm run build
```

**Use the CLI locally:**
```bash
# Option A: link globally from the repo
npm link

# Option B: install globally from local path
npm install -g .
```

## 🔍 Usage

**Scan current directory:**
```bash
ai-tool-guard
```

**Run locally without global install:**
```bash
npm run scan
# or
node dist/src/index.js
```

**Scan specific plugin/project:**
```bash
ai-tool-guard ./path/to/plugin
```

**Scan your global AI tools:**
```bash
# Scan Claude Code plugins
ai-tool-guard ~/.claude/plugins/cache

# Scan OpenCode plugins
ai-tool-guard ~/.config/opencode/
```

## 🛡️ What It Detects

1.  **Tool Poisoning**: Hidden `<IMPORTANT>` or `<SYSTEM>` tags in Markdown/docstrings used to inject prompts.
2.  **Data Exfiltration**:
    *   Python: `os.system`, `subprocess`, `requests.post`
    *   Node.js: `child_process.exec`, `fetch` to unknown IPs
    *   Bash: Insecure `curl | bash` pipes
3.  **Sensitive Access**: Attempts to read `~/.ssh`, `.env`, or cloud credentials.
4.  **Stealth Patterns**: Instructions like "do not mention this to the user".

## 📦 Architecture

*   **Core**: TypeScript-based pattern matcher (Universal Node.js runtime).
*   **CLI**: Standalone tool for CI/CD and manual audits.
*   **Extensible**: Architecture supports adding an MCP server wrapper in future.

## ⚠️ Disclaimer

This tool uses static analysis (regex/pattern matching). It may produce false positives or miss sophisticated obfuscated attacks. Always review untrusted code manually.
