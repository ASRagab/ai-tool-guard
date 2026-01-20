#!/usr/bin/env node
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
const scanner_1 = require("./scanner");
const path = __importStar(require("path"));
async function main() {
    const targetDir = process.argv[2] || process.cwd();
    console.log(`🛡️  AI Tool Guard: Scanning ${targetDir}...`);
    const scanner = new scanner_1.SecurityScanner();
    const results = await scanner.scanDirectory(path.resolve(targetDir));
    if (results.length === 0) {
        console.log('✅ No suspicious patterns found.');
        process.exit(0);
    }
    console.log(`\n⚠️  Found ${results.length} files with suspicious patterns:\n`);
    let totalIssues = 0;
    results.forEach(result => {
        console.log(`📄 File: ${path.relative(process.cwd(), result.filePath)}`);
        result.matches.forEach(match => {
            totalIssues++;
            console.log(`   [${match.id}] Line ${match.line}: ${match.description}`);
            console.log(`   Code: "${match.match}"\n`);
        });
    });
    console.log(`🚨 Scan complete. Found ${totalIssues} potential issues.`);
    process.exit(1);
}
main().catch(console.error);
