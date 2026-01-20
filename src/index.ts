#!/usr/bin/env node
import { BaseScanner } from './scanners/base-scanner';
import * as path from 'path';

async function main() {
  const targetDir = process.argv[2] || process.cwd();
  console.log(`🛡️  AI Tool Guard: Scanning ${targetDir}...`);

  const scanner = new BaseScanner();
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
