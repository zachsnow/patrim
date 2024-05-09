import util from "util";
import { Register } from "./parse";
import { assert, isSimpleObject, SimpleObject } from "./util";

/**
 * An evaluation derivation that tracks each rule that was applied
 * to the input, in order.
 *
 * TODO: track intermediate terms; since the input is mutated, we can't
 * just keep a reference.
 */
class Derivation {
  public readonly rules: Rule[] = [];

  public extend = (rule: Rule) => {
    this.rules.push(rule);
  };

  public toString(): string {
    return this.rules.map((rule) => rule.name).join(" -> ");
  }
}

export namespace Context {
  /**
   * Reduction strategies.
   */
  export type Strategy = "innermost-leftmost" | "outermost-leftmost";
}

/**
 * Evaluation context.
 */
export class Context {
  /** The current set of rewrite rules. */
  public readonly rules: Rule[];

  /**
   * All derivations that have been performed in this context.
   */
  public readonly derivations: Derivation[] = [];

  constructor(
    /** The current set of rewrite rules. */
    rules: Rule[] = [],
    /** The reduction strategy. */
    public strategy: Context.Strategy = "outermost-leftmost",
    /** The current rewriting iteration. */
    public iteration: number = 0,
    /** The maximum number of rewrites to perform before raising an error */
    public maxIterations: number = 1000,
  ) {
    this.rules = [...rules];
  }

  /**
   * Add a new term rule.
   *
   * @param pattern
   * @param replacement
   * @returns
   */
  public addRule = (pattern: unknown, replacement: unknown, name?: string): Rule => {
    const rule = new Rule(
      pattern,
      { type: "term", term: replacement },
      name ?? `rule-${this.rules.length}`,
    );

    this.rules.push(rule);
    return rule;
  };

  /**
   * Remove the given `rule` (either by reference or by name).
   *
   * @param rule either a `Rule` instance or the name of a rule
   * @returns `true` if the rule was removed, `false` otherwise
   */
  public removeRule = (rule: unknown): boolean => {
    if (typeof rule === "string") {
      const matchingRule = this.rules.find((r) => r.name === rule);
      if (matchingRule) {
        return this.removeRule(matchingRule);
      }
      return false;
    }

    if (rule instanceof Rule) {
      const i = this.rules.indexOf(rule as Rule);
      if (i >= 0) {
        this.rules.splice(i, 1);
        return true;
      }
      return false;
    }

    return false;
  };

  /**
   * Reset the current iteration count.
   */
  public resetIteration = () => {
    this.iteration = 0;
  };

  /**
   * Begin a new derivation.
   */
  public newDerivation = () => {
    this.derivations.push(new Derivation());
  };

  /**
   * Extend the current derivation with the given `rule`; this should be called
   * when a rule is evaluated.
   *
   * @param rule
   */
  public extendDerivation = (rule: Rule) => {
    if (this.derivations.length === 0) {
      this.derivations.push(new Derivation());
    }
    this.derivations[this.derivations.length - 1].extend(rule);
  };
}

export namespace Rule {
  export type Builtin = (this: Context, bindings: Bindings) => unknown;

  export type Replacement =
    | {
        type: "term";
        term: unknown;
      }
    | {
        type: "builtin";
        builtin: Builtin;
      };

  export type Bindings = Record<string, { value: unknown; eager?: boolean; splat?: boolean }>;
}

/**
 * Rewrite rule.
 *
 * @internal
 */
export class Rule {
  constructor(
    public readonly pattern: unknown,
    public readonly replacement: Rule.Replacement,
    public readonly name: string,
  ) {}

  public match(input: unknown): Rule.Bindings | null {
    return match(this.pattern, input);
  }

  public evaluate(bindings: Rule.Bindings, context: Context): unknown {
    switch (this.replacement.type) {
      case "term":
        return instantiate(this.replacement.term, bindings);
      case "builtin":
        return this.replacement.builtin.call(context, bindings);
    }
  }

  public toString(): string {
    switch (this.replacement.type) {
      case "term":
        return `${this.pattern} => ${this.replacement.term}`;
      case "builtin":
        return `${this.pattern} => builtin ${this.replacement.builtin.name || "(anonymous)"}`;
    }
  }

  [util.inspect.custom]() {
    return `${this.name}: ${this}`;
  }
}

/**
 * Helper to create a rule that rewrites the given `pattern` to be the given `replacement`.
 *
 * @param pattern the term to match
 * @param replacement the term to replace the matched term with
 * @param name an optional name for the rewrite rule; used when printing derivations
 * @returns a `Rule` instance
 */

export const rule = (pattern: unknown, replacement: unknown, name?: string) =>
  new Rule(pattern, { type: "term", term: replacement }, name ?? `${pattern}`);

/**
 * Helper to create a rule that matches the given `pattern` and invokes the given `builtin`.
 *
 * @param pattern the term to match
 * @param builtin the builtin to invoke when the term matches
 * @param name an optional name for the rewrite rule; used when printing derivations
 * @returns a `Rule` instance
 */
export const builtin = (pattern: unknown, builtin: Rule.Builtin, name?: string) =>
  new Rule(pattern, { type: "builtin", builtin }, name ?? `${pattern}`);

/**
 * Helper to create a rule that rewrites the given `name` to be the given `value`.
 *
 * @param name the string to match
 * @param value the value to replace the string with
 * @param derivationName the name to use in derivations; defaults to `name`
 * @returns a `Rule` instance
 */
export const constant = (name: string, value: unknown, derivationName?: string) =>
  rule(name, [() => value, []], derivationName ?? name);

/**
 * Given a `pattern` and an `input`, attempts to match the input against the pattern.
 * If the input matches the pattern, a (possibly empty) set of `Bindings` are returned;
 * otherwise returns `null`. Matching is applicative and does not mutate the rule
 * or the input.
 *
 * @param pattern the pattern term to match
 * @param input the input term to match against the pattern
 * @returns the bindings, if the input matches the pattern; otherwise, `null`
 *
 * @internal
 */
export function match(pattern: unknown, input: unknown): Rule.Bindings | null {
  function match(pattern: unknown, input: unknown, bindings: Rule.Bindings): boolean {
    // Dereference the already-bound registers.
    if (pattern instanceof Register) {
      pattern = bindings[pattern.name]?.value ?? pattern;
    }

    // If the rule is an unbound register, bind it.
    if (pattern instanceof Register) {
      if (pattern.match(input)) {
        bindings[pattern.name] = {
          value: input,
        };
        if (pattern.kind === "eager") {
          bindings[pattern.name].eager = true;
        }
        return true;
      }
      return false;
    }

    // Otherwise, match.
    switch (typeof pattern) {
      case "bigint":
      case "boolean":
      case "string":
      case "number":
      case "function":
      case "symbol":
      case "undefined":
        // Primitives use value equality.
        return pattern === input;
      case "object":
        if (pattern === null) {
          return input === null;
        }

        // Arrays are matched element-wise.
        if (Array.isArray(pattern)) {
          if (!Array.isArray(input)) {
            return false;
          }

          // Zip the input and output arrays together, accommodating splats.
          let splat = false;
          let i = 0;
          for (; i < pattern.length; i++) {
            const r = pattern[i];

            // Pattern contains a splat and matches the rest of the input.
            if (r instanceof Register && r.splat) {
              // TODO: allow a single splat anywhere in the array.
              assert(i === pattern.length - 1, "splat must be last element in array");
              bindings[r.name] = {
                value: input.slice(i),
                splat: true,
              };
              if (r.kind === "eager") {
                bindings[r.name].eager = true;
              }
              splat = true;
              break;
            }

            // Pattern is too long.
            if (i >= input.length) {
              return false;
            }

            // Pattern does not match.
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
        if (isSimpleObject(pattern)) {
          if (input === null || typeof input !== "object") {
            return false;
          }
          for (const key in pattern) {
            if (!match((pattern as any)[key], (input as any)[key], bindings)) {
              return false;
            }
          }
          return true;
        }

        // Class instances are treated as primitives, and use value equality.
        return pattern === input;
    }
  }

  const bindings: Rule.Bindings = {};
  if (match(pattern, input, bindings)) {
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
export function instantiate(term: unknown, bindings: Rule.Bindings): unknown {
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
export const evaluateTerm = async (input: unknown, context: Context): Promise<unknown> => {
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
              bindings[key].value = await evaluateTerm(bindings[key].value, context);
            }
          }

          // Instantiate the replacement using the (potentially evaluated) bindings.
          const replacement = rule.evaluate(bindings, context);

          // Record the derivation.
          context.extendDerivation(rule);

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
  if (context.iteration >= context.maxIterations) {
    throw new Error("maximum number of iterations reached");
  }

  return input;
};

export const evaluateTerms = async (input: unknown[], context: Context): Promise<unknown[]> => {
  const result: unknown[] = [];
  for (const term of input) {
    context.resetIteration();
    context.newDerivation();
    const value = await evaluateTerm(term, context);
    result.push(value);
  }
  return result;
};
