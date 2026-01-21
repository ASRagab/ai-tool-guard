const fs = require('fs');
const path = require('path');

const dirs = [
  'src/detectors',
  'src/scanners',
  'src/formatters',
  'src/utils',
];

let files = [];
for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (f.endsWith('.ts')) files.push(path.join(d, f));
  }
}

files.push('src/index.ts', 'src/walker.ts');

const exclude = new Set([
  'src/autodetect.ts',
  'src/scanners/ast-scanner.ts',
]);

for (const file of files) {
  if (exclude.has(file) || !fs.existsSync(file)) continue;
  const txt = fs.readFileSync(file, 'utf8');
  const out = txt.replace(/from\s+(['"])(\.\.?(?:\/[^'"\n]+)+)\1/g, (m, q, p) => {
    if (p.endsWith('.js')) return m;
    return 'from ' + q + p + '.js' + q;
  });
  if (out !== txt) {
    fs.writeFileSync(file, out, 'utf8');
    console.log('updated', file);
  }
}
