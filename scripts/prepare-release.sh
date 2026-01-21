#!/bin/bash
set -e

echo "🚀 Preparing release..."

# Check clean git state
if [[ -n $(git status -s) ]]; then
  echo "❌ Git working directory not clean. Commit or stash changes first."
  exit 1
fi

# Run tests
echo "🧪 Running tests..."
npm test

# Check TypeScript
echo "🔍 Checking TypeScript..."
npx tsc --noEmit

# Test package
echo "📦 Testing package..."
npm pack
tar -xzf ai-tool-guard-*.tgz
cd package && npm install
node dist/src/index.js --version
cd .. && rm -rf package ai-tool-guard-*.tgz

# Test coverage
echo "📊 Checking coverage..."
npm run test:coverage

echo "✅ Release preparation complete!"
echo ""
echo "Next steps:"
echo "1. Update version in package.json (currently $(node -p "require('./package.json').version"))"
echo "2. Update CHANGELOG.md"
echo "3. git commit -m 'chore: prepare vX.Y.Z release'"
echo "4. git tag vX.Y.Z"
echo "5. git push && git push --tags"
echo "6. npm publish (or wait for GitHub Action)"
