import { builtin, constant, Context, evaluateTerm, Rule, rule } from "./evaluate";
import { reg } from "./parse";
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
      assert(typeof fn === "function");
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
  ),
  rule(
    ["#remove-rule", reg("rule", undefined, false, "eager")],
    [
      function (this: Context, rule: unknown) {
        return this.removeRule(rule);
      },
      [reg("rule")],
    ],
  ),

  // Access to the evaluation context.
  rule("#context", [
    function (this: Context) {
      return this;
    },
    [],
  ]),

  rule(
    ["#exit", reg("n", "number")],
    [
      function (this: Context, n: number) {
        process.exit(n);
      },
      [reg("n")],
    ],
  ),
];

const OperatorBuiltins: Rule[] = [
  // Comparisons.
  binaryEagerOperator("===", (a, b) => a === b),
  binaryEagerOperator("!==", (a, b) => a !== b),
  binaryEagerOperator("==", (a, b) => a == b),
  binaryEagerOperator("!=", (a, b) => a != b),

  // Arithmetic.
  binaryNumericOperator("+", (a, b) => a + b),
  binaryNumericOperator("-", (a, b) => a - b),
  binaryNumericOperator("*", (a, b) => a * b),
  binaryNumericOperator("/", (a, b) => a / b),
  binaryNumericOperator("%", (a, b) => a % b),
];

const ObjectBuiltins: Rule[] = [
  rule(
    [
      "#get",
      reg("object", undefined, undefined, "eager"),
      reg("key", undefined, undefined, "eager"),
    ],
    [(object: any, key: any) => object[key], [reg("object"), reg("key")]],
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
