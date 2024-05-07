set -euo pipefail

echo "Type checking..."
pnpm exec --noEmit

echo "Building executables..."
pnpm exec tsc --build tsconfig.build.json
chmod u+x build/bin/*
