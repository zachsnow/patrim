set -euo pipefail

# Type check everything, including tests.
echo "Type checking..."
pnpm exec tsc --noEmit

# Only build source files, not tests.
echo "Building executables..."
pnpm exec tsc --build tsconfig.build.json
chmod u+x ./dist/bin/*

# The shebang lets us run `pc` directly as TypeScript
# via `ts-node`, but we need to change it to use `node` in
# the compiled JS.
sed -i '' '1 s/ts-node/node/' ./dist/bin/pc.js

# Bundle the library for web use with a shim.
echo "Bundling..."
pnpm exec rollup ./dist/src/index.js -f iife -o dist/lib/patrim.js --name patrim --external util --globals util:utilShim --context window
cat ./src/shim.js | cat - ./dist/lib/patrim.js > ./dist/lib/temp && mv ./dist/lib/temp ./dist/lib/patrim.js
