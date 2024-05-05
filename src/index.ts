import { assert, isSimpleObject, SimpleObject } from "./util";

export type Kind = "lazy" | "eager";

/**
 * @internal
 */
export class Register {
  constructor(
    /** The register name */
    public readonly name: string,

    /** The type of values that the register is allowed to match */
    public readonly type?: string,

    /** Whether the register can match an arbitrary number of terms */
    public readonly splat: boolean = false,

    /**
     * Whether the register should fully evaluate terms that it matches
     * during instantiation.
     */
    public readonly kind: Kind = "lazy",
  ) {}

  /**
   * Determines whether this register matches the given `input`.
   *
   * @param input a term to match
   * @returns `true` when the register matches the input; `false` otherwise
   */
  public match(input: unknown): boolean {
    if (this.type) {
      const type = typeof input;
      switch (type) {
        case "bigint":
        case "boolean":
        case "string":
        case "number":
        case "function":
        case "symbol":
        case "undefined":
          return this.type === type;
        case "object":
          assert(input !== undefined);
          if (input === null) {
            return this.type === "null";
          }
          if (Array.isArray(input)) {
            return this.type === "array";
          }
          if (isSimpleObject(input)) {
            return this.type === "object";
          }
          return this.type === input.constructor.name;
      }
    }

    return true;
  }

  public toString(): string {
    return `${this.kind === "lazy" ? "?" : "!"}${this.splat ? "*" : ""}${this.name}${this.type ? `:${this.type}` : ""}`;
  }

  public static parse(input: string): Register | undefined {
    input = input.trim();
    const m = input.match(/^([\?\!])(\*)?([a-zA-Z0-9-_\.]+)(\:.+)?$/);
    if (!m) {
      return;
    }
    return new Register(m[3], m[4]?.slice(1), m[2] === "*", m[1] === "?" ? "lazy" : "eager");
  }
}

/**
 * Convenience function for creating a new register.
 */
export const reg = (name: string, type?: string, splat?: boolean, kind?: Kind) =>
  new Register(name, type, splat, kind);

/** A token corresponding to a literal "(" */
export const BeginTerm = Symbol("BeginTerm");

/** A token corresponding to a literal ")" */
export const EndTerm = Symbol("EndTerm");

/** A token corresponding to a literal "\n" */
export const EndOfLine = Symbol("EndOfLine");

/** A token corresponding to the end of the input. */
export const EndOfInput = Symbol("EndOfInput");

/**
 * The (syntactic) type of tokens.
 */
export type Token =
  | typeof BeginTerm
  | typeof EndTerm
  | typeof EndOfLine
  | typeof EndOfInput
  | Register
  | string
  | number
  | boolean
  | null
  | undefined;

/**
 * Lexes the given `input` string into a list of tokens. These tokens are either JS primitives
 * (e.g. `true`, `false`, strings, numbers, etc.), registers (e.g. `?x`, `!y:number` -- returned
 * as instances of `Register`), or the symbols `BeginTerm` (for "("), `EndTerm` (for ")"), and
 * `EndOfLine` (for newlines).
 *
 * @param input
 * @returns Token[]
 */
export const lex = (input: string): Token[] => {
  const Ignore = Symbol("Ignore");

  const matches = input.match(/\(|\)|"[^"\\]*(?:\\[\s\S][^"\\]*)*"|[^\s\(\)]+|\s+/g) || [];
  const tokens: (Token | typeof Ignore)[] = matches.map((token) => {
    // Ignore undefined matches.
    if (!token) {
      return Ignore;
    }

    // Terms.
    if (token === "(") {
      return BeginTerm;
    }
    if (token === ")") {
      return EndTerm;
    }

    // We map any whitespace that includes a newline to a single newline;
    // this allows us to treat top-level newlines specially when parsing.
    if (token.includes("\n")) {
      return EndOfLine;
    }

    // Otherwise, we trim the token and discard it if it's empty.
    token = token.trim();
    if (!token) {
      return Ignore;
    }

    // Null.
    if (token === "null") {
      return null;
    }

    // Undefined.
    if (token === "undefined") {
      return undefined;
    }

    // Booleans.
    if (token === "true" || token === "false") {
      return token === "true";
    }

    // Numbers.
    const n = Number(token);
    if (!isNaN(n)) {
      return n;
    }

    // Registers.
    const r = Register.parse(token);
    if (r) {
      return r;
    }

    // If it is quoted, discard the quotes and interpret escapes within.
    if (token[0] === '"') {
      return interpretEscapes(token.slice(1, -1));
    }

    // Unquoted strings don't interpret escapes.
    return token;
  });

  // Discard empty tokens and append end of input.
  const nonEmptyTokens = tokens.filter((token): token is Token => token !== Ignore);
  nonEmptyTokens.push(EndOfInput);
  return nonEmptyTokens;
};

/**
 * "Unescapes" escape sequences in `input`, so that e.g. `"\\n"` becomes `"\n"`.
 *
 * @param input
 * @returns the input string with escapes interpreted.
 */
const interpretEscapes = (input: string): string => {
  return input.replace(
    /\\[0-9]|\\['"\bfnrtv]|\\x[0-9a-f]{2}|\\u[0-9a-f]{4}|\\u\{[0-9a-f]+\}|\\./gi,
    (match) => {
      switch (match[1]) {
        case "'":
        case '"':
        case "\\":
          return match[1];
        case "b":
          return "\b";
        case "f":
          return "\f";
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "v":
          return "\v";
        case "u":
          if (match[2] === "{") {
            return String.fromCodePoint(parseInt(match.substring(3), 16));
          }
          return String.fromCharCode(parseInt(match.substring(2), 16));
        case "x":
          return String.fromCharCode(parseInt(match.substring(2), 16));
        case "0":
          return "\0";
        default: // E.g., "\q" === "q"
          return match.substring(1);
      }
    },
  );
};

export class Tokenizer {
  private index: number = 0;
  constructor(private tokens: Token[]) {}

  public get current(): Token {
    if (this.index >= this.tokens.length) {
      return EndOfInput;
    }
    return this.tokens[this.index];
  }

  public next(): void {
    this.index++;
  }
}

/**
 * The type of (syntactic) terms. At runtime a term might evaluate,
 * via a foreign call, to an instance of an arbitrary class; however with respect to
 * parsing all terms have the type of either a plain token, a list of terms, or a simple object
 * with terms as values.
 */
export type Term = Token | Term[] | { [K: string]: Term };

/**
 * The type of syntactic programs.
 */
export type Program = Term[];

const parseTerm = (tokenizer: Tokenizer): Term => {
  // Skip newlines within terms.
  while (tokenizer.current === EndOfLine) {
    tokenizer.next();
  }

  switch (tokenizer.current) {
    case BeginTerm:
      tokenizer.next();
      const term = [];
      while ((tokenizer.current as Token) !== EndTerm) {
        term.push(parseTerm(tokenizer));
      }
      tokenizer.next();
      return term;
    case EndTerm:
      throw new Error("unexpected ')'");
    case EndOfInput:
      throw new Error("unexpected end of input");
    default:
      const token = tokenizer.current;
      tokenizer.next();
      return token;
  }
};

const parseLine = (tokenizer: Tokenizer): Term => {
  // Parse a single line of the program, ignoring newlines within parens.
  const terms: Term[] = [];
  while (true) {
    switch (tokenizer.current) {
      case BeginTerm:
        terms.push(parseTerm(tokenizer));
        break;
      case EndTerm:
        throw new Error("unexpected ')'");
      case EndOfLine:
      case EndOfInput:
        tokenizer.next();
        // Unwrap single terms automatically, so that e.g.
        // (1) parses to 1 and not [1].
        if (terms.length === 1) {
          return terms[0];
        }
        // Otherwise leave them wrapped, so we can write `1 2` to get `[1, 2]`.
        return terms;
      default:
        terms.push(tokenizer.current);
        tokenizer.next();
    }
  }
};

const parseProgram = (tokenizer: Tokenizer): Program => {
  const program: Term[] = [];
  while (true) {
    // Skip empty lines.
    while ((tokenizer.current as Token) === EndOfLine) {
      tokenizer.next();
    }

    // If we are out of input, we don't want to push an empty term.
    if (tokenizer.current === EndOfInput) {
      break;
    }

    // Parse a term.
    program.push(parseLine(tokenizer));
  }
  return program;
};

/**
 * Parses the given `input` string into a list of top-level terms.
 *
 * @param input a string containing a Patrim program
 * @returns a program
 */
export const parse = (input: string): Program => {
  const tokens = lex(input);
  const tokenizer = new Tokenizer(tokens);
  return parseProgram(tokenizer);
};

/**
 * Reduction strategies.
 */
export type Strategy = "innermost-leftmost" | "outermost-leftmost";

/**
 * Evaluation context.
 */
export class Context {
  constructor(
    /** The current set of rewrite rules */
    public readonly rules: Rule[] = [],
    /** The reduction strategy */
    public strategy: Strategy = "outermost-leftmost",
    /** The current rewriting iteration */
    public iteration: number = 0,
    /** The maximum number of rewrites to perform before raising an error */
    public maxIterations: number = 1000,
  ) {}

  public addRule = (pattern: unknown, replacement: unknown): Rule => {
    const rule = new Rule(pattern, { type: "term", term: replacement });
    this.rules.push(rule);
    return rule;
  };

  public removeRule = (rule: unknown): boolean => {
    const i = this.rules.indexOf(rule as Rule);
    if (i >= 0) {
      this.rules.splice(i, 1);
      return true;
    }
    return false;
  };
}

type Builtin = (this: Context, bindings: Bindings) => unknown;

type Replacement =
  | {
      type: "term";
      term: unknown;
    }
  | {
      type: "builtin";
      builtin: Builtin;
    };

/**
 * Rewrite rule.
 *
 * @internal
 */
export class Rule {
  constructor(
    public readonly pattern: unknown,
    public readonly replacement: Replacement,
  ) {}

  public match(input: unknown): Bindings | null {
    return match(this.pattern, input);
  }

  public evaluate(bindings: Bindings, context: Context): unknown {
    switch (this.replacement.type) {
      case "term":
        return instantiate(this.replacement.term, bindings);
      case "builtin":
        return this.replacement.builtin.call(context, bindings);
    }
  }
}

export const rule = (pattern: unknown, replacement: unknown) =>
  new Rule(pattern, { type: "term", term: replacement });

export const builtin = (pattern: unknown, builtin: Builtin) =>
  new Rule(pattern, { type: "builtin", builtin });

export const constant = (name: string, value: unknown) => rule(name, [() => value, []]);

const binaryNumericOperator = (op: string, fn: (a: any, b: any) => any): Rule => {
  return rule([reg("a", "number"), op, reg("b", "number")], [fn, reg("a"), reg("b")]);
};

const binaryEagerOperator = (op: string, fn: (a: any, b: any) => any): Rule => {
  return rule(
    [reg("a", undefined, undefined, "eager"), op, reg("b", undefined, undefined, "eager")],
    [fn, reg("a"), reg("b")],
  );
};

export const CoreBuiltins: Rule[] = [
  // Calling functions.
  builtin(
    [reg("fn", "function"), reg("args", "array")],
    function (this: Context, bindings: Bindings) {
      const fn = bindings.fn?.value;
      assert(typeof fn === "function");
      return fn.apply(this, bindings.args.value);
    },
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
      reg("rule"),
    ],
  ),

  // Access to the evaluation context.
  rule("#context", [
    function (this: Context) {
      return this;
    },
    [],
  ]),
];

export const OperatorBuiltins: Rule[] = [
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

export const ObjectBuiltins: Rule[] = [
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

export const ExceptionBuiltins: Rule[] = [
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
      reg("term"),
    ],
  ),

  rule(
    ["#throw", reg("error", undefined, undefined, "eager")],
    [
      (error: unknown) => {
        throw error;
      },
      [reg("error")],
    ],
  ),
];

export const Builtins: Rule[] = [
  ...CoreBuiltins,
  ...OperatorBuiltins,
  ...OperatorBuiltins,
  ...ExceptionBuiltins,
];

type Bindings = Record<string, { value: unknown; eager?: boolean; splat?: boolean }>;

/**
 * Given a `rule` and an `input`, attempts to match the input against the rule.
 * If the input matches the rule, a (possibly empty) set of `Bindings` are returned;
 * otherwise returns `null`. Matching is applicative and does not mutate the rule
 * or the input.
 *
 * @param rule the rule to match
 * @param input the input to match against the rule
 * @returns the bindings, if the input matches the rule; otherwise, `null`
 * @internal
 */
export function match(rule: unknown, input: unknown): Bindings | null {
  function match(rule: unknown, input: unknown, bindings: Bindings): boolean {
    // Dereference the already-bound registers.
    if (rule instanceof Register) {
      rule = bindings[rule.name]?.value ?? rule;
    }

    // If the rule is an unbound register, bind it.
    if (rule instanceof Register) {
      if (rule.match(input)) {
        bindings[rule.name] = {
          value: input,
          eager: rule.kind === "eager",
        };
        return true;
      }
      return false;
    }

    // Otherwise, match.
    switch (typeof rule) {
      case "bigint":
      case "boolean":
      case "string":
      case "number":
      case "function":
      case "symbol":
      case "undefined":
        // Primitives use value equality.
        return rule === input;
      case "object":
        if (rule === null) {
          return input === null;
        }

        // Arrays are matched element-wise.
        if (Array.isArray(rule)) {
          if (!Array.isArray(input)) {
            return false;
          }

          // Zip the input and output arrays together, accommodating splats.
          let splat = false;
          let i = 0;
          for (; i < rule.length; i++) {
            const r = rule[i];

            // Rule contains a splat and matches the rest of the input.
            if (r instanceof Register && r.splat) {
              // TODO: allow a single splat anywhere in the array.
              assert(i === rule.length - 1, "splat must be last element in array");
              bindings[r.name] = {
                value: input.slice(i),
                eager: r.kind === "eager",
                splat: true,
              };
              splat = true;
              break;
            }

            // Rule is too long.
            if (i >= input.length) {
              return false;
            }

            // Rule does not match.
            if (!match(r, input[i], bindings)) {
              return false;
            }
          }

          // Ensure the input is not longer than the rule, unless there is a splat.
          if (i <= input.length - 1 && !splat) {
            return false;
          }

          return true;
        }

        // Objects are matched key-wise; extra keys in the input are ignored.
        if (isSimpleObject(rule)) {
          if (input === null || typeof input !== "object") {
            return false;
          }
          for (const key in rule) {
            if (!match((rule as any)[key], (input as any)[key], bindings)) {
              return false;
            }
          }
          return true;
        }

        // Class instances are treated as primitives, and use value equality.
        return rule === input;
    }
  }

  const bindings: Bindings = {};
  if (match(rule, input, bindings)) {
    return bindings;
  }

  return null;
}

/**
 * Given a `term` possibly containing registers, replace all registers with their
 * bound values. Registers for which no binding exists are are replaced with `undefined`.
 * Structured values (arrays and objects) are copied, not mutated.
 *
 * @param term the term to instantiate
 * @param bindings the bindings to use for registers
 * @returns the instantiated term
 *
 * @internal
 */
export function instantiate(term: unknown, bindings: Bindings): unknown {
  if (term instanceof Register) {
    return bindings[term.name]?.value;
  }

  switch (typeof term) {
    case "bigint":
    case "boolean":
    case "string":
    case "number":
    case "function":
    case "symbol":
    case "undefined":
      return term;
    case "object":
      if (term === null) {
        return null;
      }

      if (Array.isArray(term)) {
        const result: unknown[] = [];
        for (const item of term) {
          if (item instanceof Register && item.splat) {
            let elements: unknown = bindings[item.name]?.value ?? [];
            assert(Array.isArray(elements), "expected array binding for splat");
            result.push(...elements.map((element) => instantiate(element, bindings)));
          } else {
            result.push(instantiate(item, bindings));
          }
        }
        return result;
      }

      if (isSimpleObject(term)) {
        const result: SimpleObject = {};
        for (const key in term) {
          result[key] = instantiate(term[key], bindings);
        }
        return result;
      }

      return term;
  }
}

type Location = { object: unknown; key: string | number };
type Subterm = { term: unknown; location?: Location };

/**
 * Yields all subterms of `input`. The order is dictated by the given `context`'s
 * strategy.
 *
 * @internal
 */
export function* subterms(
  input: unknown,
  context: Context,
): Generator<Subterm, undefined, undefined> {
  function* subterms(
    input: unknown,
    location?: Location,
  ): Generator<Subterm, undefined, undefined> {
    const current = {
      term: input,
      location,
    };

    if (context.strategy === "outermost-leftmost") {
      yield current;
    }

    switch (typeof input) {
      case "bigint":
      case "boolean":
      case "string":
      case "number":
      case "function":
      case "symbol":
      case "undefined":
        break;
      case "object":
        if (input === null) {
          break;
        }
        if (Array.isArray(input)) {
          for (let i = 0; i < input.length; i++) {
            yield* subterms(input[i], { object: input, key: i });
          }
          break;
        }
        if (isSimpleObject(input)) {
          for (let key in input) {
            yield* subterms(input[key], { object: input, key });
          }
        }
        break;
    }

    if (context.strategy === "innermost-leftmost") {
      yield current;
    }
  }

  yield* subterms(input);
}

/**
 * Evaluates the given `input` term under the given `context` by repeatedly
 * rewriting the term using the context's rules until a fixed point is reached.
 *
 * @param input the term to rewrite
 * @param context the context to rewrite under
 * @returns the rewritten term
 */
const evaluateTerm = (input: unknown, context: Context): unknown => {
  for (; context.iteration < context.maxIterations; context.iteration++) {
    let changed = false;

    subterms: for (const subterm of subterms(input, context)) {
      const term = subterm.term;
      const location = subterm.location;

      for (const rule of context.rules) {
        // Check if this rule matches the current subterm.
        const bindings = rule.match(term);
        if (bindings) {
          // If it does, evaluate any eager bindings.
          for (const key in bindings) {
            if (bindings[key].eager) {
              bindings[key].value = evaluateTerm(bindings[key].value, context);
            }
          }

          // Instantiate the replacement using the (potentially evaluated) bindings.
          const replacement = rule.evaluate(bindings, context);

          // Referentially replace the matched term with the replacement.
          if (location) {
            (location.object as any)[location.key] = replacement;
          } else {
            input = replacement;
          }

          changed = true;
          break subterms;
        }
      }
    }

    if (!changed) {
      break;
    }
  }

  return input;
};

/**
 * Evaluates the given `program` term under the (optional) `context`. If
 * no context is provided the default context is used.
 *
 * @param program the program to evaluate
 * @param context the evaluation context
 * @returns the evaluated program
 */
export const evaluate = (program: Program, context?: Context): unknown[] => {
  return program.map((term) => evaluateTerm(term, context ?? new Context(Builtins)));
};

/**
 * Executes the given `program`, discarding all but the final term.
 *
 * @param program the program to evaluate
 * @param context the evaluation context
 * @returns the execution result
 */
export const execute = (program: Program, context?: Context): unknown => {
  const evaluated = evaluate(program, context);
  if (evaluated.length) return evaluated[evaluated.length - 1];
};
