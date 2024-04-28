import { assert, isSimpleObject, SimpleObject } from "./util";

export type Kind = "lazy" | "eager";

/**
 * @internal
 */
export class Register {
  constructor(
    public readonly name: string,
    public readonly type?: string,
    public readonly splat: boolean = false,
    public readonly kind: Kind = "lazy",
  ) {}

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
    const m = input.match(/^([\?\!])(\*)?(.+)(\:.+)?$/);
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

export const BeginTerm = Symbol("BeginTerm");
export const EndTerm = Symbol("EndTerm");
export const EndOfLine = Symbol("EndOfLine");

export const lex = (input: string): unknown[] => {
  const matches = input.match(/\(|\)|"[^"\\]*(?:\\[\s\S][^"\\]*)*"|[^\s\(\)]+|\s+/g) || [];
  const tokens = matches.map((token) => {
    // Ignore undefined matches.
    if (!token) {
      return;
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
      return;
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

  // Discard empty tokens.
  return tokens.filter((token) => token !== undefined);
};

const interpretEscapes = (str: string): string => {
  return str.replace(
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

/**
 * Parse the given `input` string into a term.
 */
export const parse = (input: string): unknown[] => {
  const tokens = lex(input);
  console.info("tokens", tokens);

  const stack: unknown[][] = [[]];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    console.info("tok", token, stack);
    if (token === EndOfLine) {
      // If we are in the top-level term, and it is non-empty, then
      // the newline is treated as ") (", effectively closing the current
      // term and introducing a new term.
      if (stack.length === 2 && stack[0].length > 0) {
        const term = stack.pop();
        stack[stack.length - 1].push(term);
        stack.push([]);
      }

      // Otherwise, we skip it.
    } else if (token === BeginTerm) {
      stack.push([]);
    } else if (token === EndTerm) {
      const term = stack.pop();
      if (!stack.length) {
        throw new Error("unexpected ')'");
      }
      stack[stack.length - 1].push(term);
    } else {
      if (!stack.length) {
        throw new Error("unexpected token");
      }
      stack[stack.length - 1].push(token);
    }
  }
  if (stack.length > 1) {
    throw new Error("expected ')'");
  } else if (!stack.length) {
    throw new Error("unexpected ')'");
  }
  return stack[0];
};

/**
 * Reduction strategies.
 */
export type Strategy = "innermost-leftmost" | "outermost-leftmost";

/**
 * Rewrite context.
 */
export class Context {
  constructor(
    public readonly rules: Rule[] = [],
    public strategy: Strategy = "outermost-leftmost",
    public iteration: number = 0,
    public maxIterations: number = 1000,
  ) {
    // Core rules that need access to the context.
    this.rules.unshift(
      {
        pattern: ["#add-rule", reg("pattern"), reg("replacement")],
        replacement: [this.addRule, reg("pattern"), reg("replacement")],
      },
      {
        pattern: ["#remove-rule", reg("rule", undefined, false, "eager")],
        replacement: [this.removeRule, reg("rule")],
      },
      { pattern: "#context", replacement: this },
    );
  }

  private addRule = (pattern: unknown, replacement: unknown): Rule => {
    const rule = new Rule(pattern, replacement);
    this.rules.push(rule);
    return rule;
  };

  private removeRule = (rule: unknown): boolean => {
    const i = this.rules.indexOf(rule as Rule);
    if (i >= 0) {
      this.rules.splice(i, 1);
      return true;
    }
    return false;
  };
}

export class Rule {
  constructor(
    public readonly pattern: unknown,
    public readonly replacement: unknown,
  ) {}
}

export const rule = (pattern: unknown, replacement: unknown) => new Rule(pattern, replacement);

export const Builtins = [
  rule(
    [reg("a", "number"), "+", reg("b", "number")],
    [(a: any, b: any) => a + b, reg("a"), reg("b")],
  ),
  rule(
    [reg("a", "number"), "-", reg("b", "number")],
    [(a: any, b: any) => a - b, reg("a"), reg("b")],
  ),
  rule(
    [reg("a", "number"), "*", reg("b", "number")],
    [(a: any, b: any) => a * b, reg("a"), reg("b")],
  ),
  rule(
    [reg("a", "number"), "/", reg("b", "number")],
    [(a: any, b: any) => a / b, reg("a"), reg("b")],
  ),
];

type Bindings = Record<string, { value: unknown; eager?: boolean }>;

export function match(rule: unknown, input: unknown): Bindings | null {
  function match(rule: unknown, input: unknown, bindings: Bindings): boolean {
    // Dereference the already-bound registers.
    if (rule instanceof Register) {
      rule = bindings[rule.name] ?? rule;
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
          // TODO: ?...
          if (!Array.isArray(input) || rule.length !== input.length) {
            return false;
          }
          for (let i = 0; i < rule.length; i++) {
            if (!match(rule[i], input[i], bindings)) {
              return false;
            }
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
 */
export function instantiate(term: unknown, bindings: Bindings): unknown {
  if (term instanceof Register) {
    return bindings[term.name].value;
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
          result.push(instantiate(item, bindings));
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

const foreign = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    const head = input[0];
    if (typeof head === "function") {
      const args = input.slice(1);
      return head(...args);
    }
  }
  return input;
};

export const evaluate = (input: unknown, context?: Context): unknown => {
  context ??= new Context(Builtins);

  for (; context.iteration < context.maxIterations; context.iteration++) {
    let changed = false;

    subterms: for (const subterm of subterms(input, context)) {
      const term = subterm.term;
      const location = subterm.location;

      for (const rule of context.rules) {
        // Check if this rule matches the current subterm.
        const bindings = match(rule.pattern, term);
        if (bindings) {
          // If it does, evaluate any eager bindings.
          for (const key in bindings) {
            if (bindings[key].eager) {
              bindings[key].value = evaluate(bindings[key].value, context);
            }
          }

          // Instantiate the replacement using the (potentially evaluated) bindings.
          let replacement = instantiate(rule.replacement, bindings);

          // Check if the replacement is a foreign function call and if so call it.
          replacement = foreign(replacement);

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
