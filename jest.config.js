const path = require("path");
// Unfortunately importing this here means no comments allowed in tsconfig.json.
const tsconfig = require("./tsconfig.json");

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        isolatedModules: true,
      },
    ],
  },
  testRegex: "^.+\\.spec\\.ts$",
  testPathIgnorePatterns: ["/node_modules/"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    // Make Jest respect tsconfig paths.
    ...Object.fromEntries(
      Object.entries(tsconfig.compilerOptions.paths || {}).map(([k, [v]]) => [
        `^${k.replace(/\*/, "(.*)")}`,
        path.join("<rootDir>", v.replace(/\*/, "$1")),
      ]),
    ),
  },
};
