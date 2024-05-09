module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint"],
  rules: {
    // https://eslint.org/docs/rules/#possible-problems
    "no-compare-neg-zero": "error",
    "no-cond-assign": "error",
    "no-constant-condition": "error",
    "no-control-regex": "error",
    "no-debugger": "error",
    "no-dupe-else-if": "error",
    "no-duplicate-case": "error",
    "no-empty-character-class": "error",
    "no-empty-pattern": "error",
    "no-inner-declarations": "error",
    "no-invalid-regexp": "error",
    "no-misleading-character-class": "error",
    "no-sparse-arrays": "error",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "no-useless-backreference": "error",
    "use-isnan": "error",

    // https://github.com/typescript-eslint/typescript-eslint/tree/main/packages/eslint-plugin#supported-rules
    "@typescript-eslint/ban-ts-comment": "error",
    "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
    "@typescript-eslint/no-loss-of-precision": "error",

    "@typescript-eslint/no-misused-promises": [
      "error",
      {
        // `() => Promise<void>` should be assignable to `() => void`.
        checksVoidReturn: false,
      },
    ],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/no-throw-literal": ["error"],

    "no-restricted-properties": [
      "error",
      {
        object: "it",
        property: "only",
        message: "Please do not commit focused tests",
      },
      {
        object: "test",
        property: "only",
        message: "Please do not commit focused tests",
      },
      {
        object: "describe",
        property: "only",
        message: "Please do not commit focused tests",
      },
    ],

    "no-restricted-syntax": [
      "error",
      "WithStatement",
      {
        selector: "Identifier[name='fit']",
        message: "'fit' is restricted from being used. Please do not commit focused tests",
      },
      {
        selector: "Identifier[name='fdescribe']",
        message: "'fdescribe' is restricted from being used. Please do not commit focused tests",
      },
    ],

    eqeqeq: "error",
  },
};
