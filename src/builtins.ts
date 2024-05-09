import fs from "fs";
import { builtin, constant, Context, evaluateTerm, evaluateTerms, Rule, rule } from "./evaluate";
import { parse, reg } from "./parse";
import { assert } from "./util";

const binaryNumericOperator = (op: string, fn: (a: any, b: any) => any): Rule => {
  return rule([reg("a", "number"), op, reg("b", "number")], [fn, [reg("a"), reg("b")]], op);
};

const binaryEagerOperator = (op: string, fn: (a: any, b: any) => any): Rule => {
  return rule(
    [reg("a", undefined, undefined, "eager"), op, reg("b", undefined, undefined, "eager")],
    [fn, [reg("a"), reg("b")]],
    op,
  );
};

const unaryEagerOperator = (op: string, fn: (a: any) => any): Rule => {
  return rule([op, reg("a", undefined, undefined, "eager")], [fn, [reg("a")]], op);
};

/**
 * The core builtins that implement adding/removing rules and interacting with
 * external JS functions.
 */
export const CoreBuiltins: Rule[] = [
  // Calling functions.
  builtin(
    [reg("fn", "function"), reg("args", "array")],
    function (this: Context, bindings: Rule.Bindings) {
      const fn = bindings.fn?.value;

      // `fn` should be a function due to the register requiring a function type.
      assert(typeof fn === "function", "expected function");

      return fn.apply(this, bindings.args.value);
    },
    "call",
  ),

  // Adding and removing rules.
  rule(
    ["#add-rule", reg("pattern"), reg("replacement")],
    [
      function (this: Context, pattern: unknown, replacement: unknown) {
        return this.addRule(pattern, replacement);
      },
      [reg("pattern"), reg("replacement")],
    ],
    "#add-rule",
  ),
  rule(
    ["#add-rule", reg("pattern"), reg("replacement"), reg("name", "string")],
    [
      function (this: Context, pattern: unknown, replacement: unknown, name: string) {
        return this.addRule(pattern, replacement, name);
      },
      [reg("pattern"), reg("replacement"), reg("name")],
    ],
    "#add-rule (named)",
  ),
  rule(
    ["#remove-rule", reg("rule", undefined, false, "eager")],
    [
      function (this: Context, rule: unknown) {
        return this.removeRule(rule);
      },
      [reg("rule")],
    ],
    "#remove-rule",
  ),

  // Access to the evaluation context.
  rule(
    "#context",
    [
      function (this: Context) {
        return this;
      },
      [],
    ],
    "#context",
  ),

  rule(
    ["#include", reg("filename", "string")],
    [
      function (this: Context, filename: string) {
        const content = fs.readFileSync(filename, "utf8");
        const program = parse(content);
        evaluateTerms(program, this);
      },
      [reg("filename")],
    ],
  ),
  rule(
    ["#exit", reg("n", "number")],
    [
      function (this: Context, n: number) {
        process.exit(n);
      },
      [reg("n")],
    ],
    "#exit",
  ),
];

const OperatorBuiltins: Rule[] = [
  // Comparisons.
  binaryEagerOperator("===", (a, b) => a === b),
  binaryEagerOperator("!==", (a, b) => a !== b),
  // eslint-disable-next-line eqeqeq
  binaryEagerOperator("==", (a, b) => a == b),
  // eslint-disable-next-line eqeqeq
  binaryEagerOperator("!=", (a, b) => a != b),

  // Arithmetic.
  binaryEagerOperator("+", (a, b) => a + b),
  binaryNumericOperator("-", (a, b) => a - b),
  binaryNumericOperator("*", (a, b) => a * b),
  binaryNumericOperator("/", (a, b) => a / b),
  binaryNumericOperator("%", (a, b) => a % b),

  unaryEagerOperator("+", (a) => +a),
  unaryEagerOperator("-", (a) => -a),
  unaryEagerOperator("!", (a) => !a),
  unaryEagerOperator("~", (a) => ~a),
];

const ObjectBuiltins: Rule[] = [
  rule(
    [
      "#get",
      reg("object", undefined, undefined, "eager"),
      reg("key", undefined, undefined, "eager"),
    ],
    [(object: any, key: any) => object[key], [reg("object"), reg("key")]],
    "#get",
  ),

  rule(
    [
      "#set",
      reg("object", undefined, undefined, "eager"),
      reg("key", undefined, undefined, "eager"),
      reg("value", undefined, undefined, "eager"),
    ],
    [
      (object: any, key: any, value: any) => {
        object[key] = value;
        return value;
      },
      [reg("object"), reg("key"), reg("value")],
    ],
    "#set",
  ),

  constant("#global", globalThis),
];

const ExceptionBuiltins: Rule[] = [
  // Exceptions.
  rule(
    ["#try", reg("term")],
    [
      function (this: Context, term: unknown) {
        try {
          return evaluateTerm(term, this);
        } catch (e) {
          return e;
        }
      },
      [reg("term")],
    ],
    "#try",
  ),

  rule(
    ["#throw", reg("error", undefined, undefined, "eager")],
    [
      (error: unknown) => {
        throw error;
      },
      [reg("error")],
    ],
    "#throw",
  ),
];

/**
 * The default builtins.
 */
export const Builtins: Rule[] = [
  ...CoreBuiltins,
  ...OperatorBuiltins,
  ...ObjectBuiltins,
  ...ExceptionBuiltins,
];
