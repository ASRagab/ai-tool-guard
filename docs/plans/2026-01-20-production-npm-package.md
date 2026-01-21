# Production NPM Package Design

**Date:** 2026-01-20
**Status:** Approved
**Target Audience:** Individual developers scanning their own AI tools/plugins
**Distribution Method:** npx (no installation needed)
**Platform Support:** Unix/macOS (Node.js 18+)

---

## Design Goals

1. **Zero-friction usage** - Run via `npx ai-tool-guard` without global install
2. **Standard quality** - Unit tests, integration tests, CI checks
3. **Flexible UX** - Interactive by default, scriptable with flags
4. **Simple distribution** - Compiled JS with node_modules (Node.js required)
5. **Semver commitment** - Start at v0.1.0, iterate to v1.0.0

---

## Section 1: Package Configuration & Publishing Strategy

### Semantic Versioning Approach

Start at `v0.1.0` to signal early-stage but functional. This gives flexibility for breaking changes before `v1.0.0`. The version progression:

- `0.1.0` - Initial npm publish with core scanning features
- `0.2.0` - Add new detectors or scanners (minor)
- `0.x.y` - Bug fixes and patches
- `1.0.0` - Stable API, commitment to semver

### package.json Enhancements

```json
{
  "name": "ai-tool-guard",
  "version": "0.1.0",
  "description": "Security scanner for AI tools and extensions",
  "author": "Your Name <email@example.com>",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/ai-tool-guard"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/ai-tool-guard/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/ai-tool-guard#readme",
  "keywords": [
    "security",
    "ai",
    "mcp",
    "audit",
    "claude-code",
    "opencode",
    "tool-poisoning"
  ]
}
```

**Key Changes:**
- `files` array ensures only built code ships (no source, tests, or configs)
- `engines` field prevents installation on incompatible Node versions
- Setting minimum to Node 18 covers active LTS and gives access to modern JS features

### NPM Lifecycle Scripts

Add `prepublishOnly` to automatically build and test before publishing:

```json
"scripts": {
  "build": "tsc",
  "prepublishOnly": "npm run build && npm test",
  "prepack": "npm run build",
  "test": "npm run test:unit && npm run test:integration",
  "test:unit": "node --test dist/test/unit/**/*.test.js",
  "test:integration": "node --test dist/test/integration/**/*.test.js",
  "test:smoke": "node --test dist/test/smoke/**/*.test.js",
  "test:coverage": "c8 npm test"
}
```

This prevents accidentally publishing unbuild code or broken tests.

---

## Section 2: Build & Distribution Pipeline

### TypeScript Compilation Strategy

Keep the current `tsc` build but optimize for distribution:

```json
// tsconfig.json updates
{
  "compilerOptions": {
    "target": "ES2022",           // Modern syntax, Node 18+ supports this
    "module": "ES2022",            // Native ESM
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./",
    "declaration": true,           // Generate .d.ts for TypeScript users
    "declarationMap": true,        // Source maps for declarations
    "sourceMap": false,            // Skip source maps for production
    "removeComments": true,        // Smaller output
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test/**/*", "**/*.test.ts"]
}
```

### Shebang & Executable Setup

The CLI entry point (`dist/src/index.js`) needs proper shebang for Unix/macOS:

```javascript
#!/usr/bin/env node
```

After npm publishes, ensure executable permissions in package.json:

```json
"bin": {
  "ai-tool-guard": "./dist/src/index.js"
}
```

NPM automatically handles `chmod +x` when installing, so the binary works via npx immediately.

### Dependencies Optimization

Current deps look lean. Move `prompts` to dependencies since it's used at runtime:

**dependencies** (Runtime needs):
- chalk
- commander
- fdir
- isbinaryfile
- @nodesecure/js-x-ray
- prompts

**devDependencies** (Build-time only):
- @types/node
- @types/prompts
- typescript
- c8 (for coverage)

---

## Section 3: Testing Strategy & Quality Gates

### Test Structure

Organize tests to cover three layers:

#### 1. Unit Tests (`test/unit/`)
- Individual detector logic (Claude Code, Copilot, etc.)
- Pattern matching functions
- Utility functions (path-utils, string-utils)
- Target: 80%+ code coverage

#### 2. Integration Tests (`test/integration/`)
- Full scan workflows (autodetect → scan → report)
- File system traversal with real fixtures
- CLI argument parsing and output formatting
- Test against sample malicious/safe plugin directories

#### 3. Smoke Tests (`test/smoke/`)
- Quick sanity checks that run in <5s
- Ensures `npx ai-tool-guard --help` works
- Validates package structure after build

### Quality Checklist Before Publishing

- ✅ All tests pass (`npm test`)
- ✅ No TypeScript errors (`tsc --noEmit`)
- ✅ CLI runs via npx locally (`npx . --help`)
- ✅ README has install/usage examples
- ✅ LICENSE file exists (MIT or Apache-2.0)
- ✅ Code coverage ≥80%
- ✅ No console.log (use proper logging or remove)
- ✅ Error handling for file system operations

---

## Section 4: CI/CD Pipeline (GitHub Actions)

### Workflow Strategy

Two workflows - one for continuous validation, one for publishing.

### `.github/workflows/test.yml` - Run on every push/PR

```yaml
name: Test & Lint

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]

    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npx . --help  # Smoke test the CLI
```

Tests against multiple Node versions ensure Unix/macOS compatibility (both use similar Node binaries).

### `.github/workflows/publish.yml` - Manual or tag-triggered

```yaml
name: Publish to NPM

on:
  workflow_dispatch:  # Manual trigger
  push:
    tags:
      - 'v*'  # Trigger on version tags like v0.1.0

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Setup Requirements

- Add `NPM_TOKEN` to GitHub repository secrets (get from npmjs.com)
- Create releases via: `git tag v0.1.0 && git push --tags`

---

## Section 5: Documentation & Developer Experience

### README.md Enhancements

Update the existing README with production-ready sections:

#### 1. Badges (top of file)

```markdown
[![npm version](https://badge.fury.io/js/ai-tool-guard.svg)](https://www.npmjs.com/package/ai-tool-guard)
[![Node.js CI](https://github.com/YOUR_USERNAME/ai-tool-guard/workflows/Test%20&%20Lint/badge.svg)](https://github.com/YOUR_USERNAME/ai-tool-guard/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

#### 2. Quick Start (replace existing installation)

```markdown
## 🚀 Quick Start

No installation needed - run directly with npx:

```bash
npx ai-tool-guard
```

Or install globally:

```bash
npm install -g ai-tool-guard
ai-tool-guard ~/.claude/plugins
```
```

#### 3. Examples Section

```markdown
## 📚 Examples

# Scan current directory
npx ai-tool-guard

# Scan specific path
npx ai-tool-guard ./my-plugin

# Auto-detect AI tool and scan
npx ai-tool-guard --auto

# JSON output for scripting
npx ai-tool-guard --json > report.json
```

#### 4. Troubleshooting Section

Common issues for Unix/macOS users:
- Node.js version compatibility
- Permission errors when scanning system directories
- Path resolution issues

### Additional Documentation Files

- `CHANGELOG.md` - Track version history (start with v0.1.0 entry)
- `CONTRIBUTING.md` - Guide for contributors (optional for v0.1.0)
- `LICENSE` - MIT or Apache-2.0 license file

---

## Section 6: Pre-Launch Checklist & Deployment

### Pre-Publish Dry Run

```bash
# 1. Test local package
npm pack
tar -xzf ai-tool-guard-0.1.0.tgz
cd package && npm install
node dist/src/index.js --help

# 2. Test via local npx
npm link
npx ai-tool-guard --help

# 3. Publish dry-run
npm publish --dry-run
```

### Launch Sequence

1. Finalize version in package.json (`0.1.0`)
2. Update CHANGELOG.md with features
3. Commit: `git commit -m "chore: prepare v0.1.0 release"`
4. Tag: `git tag v0.1.0`
5. Push: `git push && git push --tags`
6. Publish: `npm publish` (or wait for GitHub Action)
7. Verify: `npx ai-tool-guard@latest --version`

### Post-Launch

- Monitor npm download stats
- Watch GitHub issues for bug reports
- Plan v0.2.0 features based on feedback

---

## Implementation Summary

### Critical Path Items

1. **Package.json Updates** - Add metadata, fix dependency classification
2. **TypeScript Config** - Optimize for production builds
3. **Shebang Addition** - Ensure CLI executable works
4. **Test Organization** - Create unit/integration/smoke test structure
5. **CI/CD Setup** - GitHub Actions for testing and publishing
6. **Documentation** - README badges, examples, troubleshooting
7. **License File** - Add MIT or Apache-2.0
8. **Dry Run Testing** - Validate package before publish

### Timeline Estimate

- **Setup (1-2 hours)** - Package config, TypeScript, dependencies
- **Testing (2-3 hours)** - Organize tests, add coverage
- **CI/CD (1 hour)** - GitHub Actions workflows
- **Documentation (1 hour)** - README updates, CHANGELOG, LICENSE
- **Validation (1 hour)** - Dry runs, local testing
- **Total: 6-8 hours** to production-ready v0.1.0

---

## Success Criteria

✅ Package installable via `npx ai-tool-guard`
✅ Works on Node.js 18, 20, 22
✅ Tests pass in CI across multiple Node versions
✅ README has clear installation and usage examples
✅ Published to npm registry
✅ Version tagged in git
✅ No breaking changes between 0.1.x releases
