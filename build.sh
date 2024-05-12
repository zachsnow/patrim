set -euo pipefail

echo "Type checking..."
pnpm exec tsc --noEmit

echo "Building executables..."
pnpm exec tsc --build tsconfig.build.json
chmod u+x ./build/bin/*

echo "Bundling..."
pnpm exec rollup ./build/src/index.js -f iife -o build/patrim.js --name patrim --external util --globals util:utilShim --context window
cat ./src/shim.js | cat - ./build/patrim.js > ./build/temp && mv ./build/temp ./build/patrim.js
