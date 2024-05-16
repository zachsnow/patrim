import { Builtins, constants } from "./builtins";
import { Context, evaluateTerms } from "./evaluate";
import { Program } from "./parse";

export { Builtins } from "./builtins";
export { builtin, constant, Context, rule } from "./evaluate";
export { parse, ParseError, printProgram, printTerm, reg } from "./parse";

/**
 * Evaluates the given `program` term under the (optional) `context`. If
 * no context is provided the default context is used.
 *
 * @param program the program to evaluate
 * @param context the evaluation context
 * @param values extra values to add to the context
 * @returns the evaluated program
 */
export const evaluate = (
  program: Program,
  context?: Context,
  values?: Record<string, unknown>,
): unknown[] => {
  const valueRules = values ? constants(values) : [];
  const c = context ?? new Context([...Builtins, ...valueRules]);
  return evaluateTerms(program, c);
};

/**
 * Executes the given `program`, discarding all but the final term. If
 * no context is provided the default context is used.
 *
 * @param program the program to evaluate
 * @param context the evaluation context
 * @param values extra values to add to the context
 * @returns the final term of the evaluated program
 */
export const execute = (
  program: Program,
  context?: Context,
  values?: Record<string, unknown>,
): unknown => {
  const evaluated = evaluate(program, context, values);
  if (evaluated.length) {
    return evaluated[evaluated.length - 1];
  }
};
