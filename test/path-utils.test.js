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

const pathUtils = require("../dist/src/utils/path-utils");
const assert = __importStar(require("assert"));
const { test } = require("node:test");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));

test('Unix Path Handling', async (t) => {
  await t.test('expandTilde expands tilde to home directory', () => {
    const homeDir = os.homedir();
    const result = pathUtils.expandTilde('~/documents');
    assert.strictEqual(result, path.join(homeDir, 'documents'));
  });

  await t.test('expandTilde handles standalone tilde', () => {
    const homeDir = os.homedir();
    const result = pathUtils.expandTilde('~');
    assert.strictEqual(result, homeDir);
  });

  await t.test('expandTilde does not modify absolute paths', () => {
    const result = pathUtils.expandTilde('/usr/local/bin');
    assert.strictEqual(result, '/usr/local/bin');
  });

  await t.test('expandTilde does not modify relative paths', () => {
    const result = pathUtils.expandTilde('./relative/path');
    assert.strictEqual(result, './relative/path');
  });

  await t.test('getHomeDir returns home directory', () => {
    const result = pathUtils.getHomeDir();
    assert.strictEqual(result, os.homedir());
  });

  await t.test('parsePATH splits on colon separator', () => {
    const originalPath = process.env.PATH;
    try {
      process.env.PATH = '/usr/bin:/usr/local/bin:/home/user/.local/bin';
      const result = pathUtils.parsePATH();
      assert.ok(result.length >= 3);
      assert.ok(result.some(p => p.includes('usr/bin')));
      assert.ok(result.some(p => p.includes('usr/local/bin')));
    } finally {
      process.env.PATH = originalPath;
    }
  });

  await t.test('parsePATH handles tilde expansion', () => {
    const originalPath = process.env.PATH;
    try {
      process.env.PATH = '~/.local/bin:/usr/bin';
      const result = pathUtils.parsePATH();
      const homeDir = os.homedir();
      assert.ok(result.some(p => p.startsWith(homeDir)));
    } finally {
      process.env.PATH = originalPath;
    }
  });

  await t.test('parsePATH filters empty entries', () => {
    const originalPath = process.env.PATH;
    try {
      process.env.PATH = '/usr/bin::/usr/local/bin';
      const result = pathUtils.parsePATH();
      assert.ok(result.every(p => p.length > 0));
    } finally {
      process.env.PATH = originalPath;
    }
  });

  await t.test('safePath joins path segments correctly', () => {
    const result = pathUtils.safePath('/usr', 'local', 'bin');
    assert.strictEqual(result, path.join('/usr', 'local', 'bin'));
  });

  await t.test('safePath handles tilde in first segment', () => {
    const homeDir = os.homedir();
    const result = pathUtils.safePath('~', '.config', 'app');
    assert.strictEqual(result, path.join(homeDir, '.config', 'app'));
  });

  await t.test('resolvePath resolves absolute paths', async () => {
    const result = await pathUtils.resolvePath(__dirname);
    assert.ok(path.isAbsolute(result));
  });

  await t.test('resolvePath handles tilde expansion', async () => {
    const homeDir = os.homedir();
    const result = await pathUtils.resolvePath('~');
    assert.strictEqual(result, homeDir);
  });

  await t.test('resolvePathSync resolves paths synchronously', () => {
    const result = pathUtils.resolvePathSync(__dirname);
    assert.ok(path.isAbsolute(result));
  });

  await t.test('resolvePath handles non-existent paths gracefully', async () => {
    const result = await pathUtils.resolvePath('/non/existent/path/12345');
    assert.ok(path.isAbsolute(result));
    assert.ok(result.includes('non/existent/path/12345'));
  });

  await t.test('isSymlink detects non-symlink files', async () => {
    const result = await pathUtils.isSymlink(__filename);
    assert.strictEqual(result, false);
  });

  await t.test('isSymlink handles non-existent paths', async () => {
    const result = await pathUtils.isSymlink('/non/existent/file');
    assert.strictEqual(result, false);
  });
});

test('Path Operations with Symlinks', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tool-guard-test-'));
  const testFile = path.join(tmpDir, 'test.txt');
  const symlinkPath = path.join(tmpDir, 'link.txt');

  try {
    // Create a test file
    fs.writeFileSync(testFile, 'test content');

    // Create a symlink (only on Unix-like systems)
    try {
      fs.symlinkSync(testFile, symlinkPath);

      await t.test('isSymlink detects symlink files', async () => {
        const result = await pathUtils.isSymlink(symlinkPath);
        assert.strictEqual(result, true);
      });

      await t.test('resolvePath resolves symlinks', async () => {
        const result = await pathUtils.resolvePath(symlinkPath);
        const realPath = fs.realpathSync(testFile);
        assert.strictEqual(result, realPath);
      });
    } catch (err) {
      // Skip symlink tests if not supported (Windows without admin)
      console.log('Skipping symlink tests (not supported on this system)');
    }
  } finally {
    // Cleanup
    try {
      if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      fs.rmdirSync(tmpDir);
    } catch (err) {
      // Ignore cleanup errors
    }
  }
});
