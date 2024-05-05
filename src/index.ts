import { Builtins } from "./builtins";
import { Context, evaluateTerm } from "./evaluate";
import { Program } from "./parse";

export { Context } from "./evaluate";
export { parse } from "./parse";

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
  return program.map((term) => {
    const value = evaluateTerm(term, c);
    return value;
  });
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
  if (evaluated.length) {
    return evaluated[evaluated.length - 1];
  }
};
