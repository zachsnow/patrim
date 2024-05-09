import { Builtins } from "./builtins";
import { Context, evaluateTerms } from "./evaluate";
import { Program } from "./parse";

export { Context } from "./evaluate";
export { parse, ParseError } from "./parse";

/**
 * Evaluates the given `program` term under the (optional) `context`. If
 * no context is provided the default context is used.
 *
 * @param program the program to evaluate
 * @param context the evaluation context
 * @returns the evaluated program
 */
export const evaluate = (program: Program, context?: Context): unknown[] => {
  const c = context ?? new Context(Builtins);
  return evaluateTerms(program, c);
};

/**
 * Executes the given `program`, discarding all but the final term. If
 * no context is provided the default context is used.
 *
 * @param program the program to evaluate
 * @param context the evaluation context
 * @returns the final term of the evaluated program
 */
export const execute = (program: Program, context?: Context): unknown => {
  const evaluated = evaluate(program, context);
  if (evaluated.length) {
    return evaluated[evaluated.length - 1];
  }
};
