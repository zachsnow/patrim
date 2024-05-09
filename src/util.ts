/**
 * An assertion that also applies at the type level.
 *
 * @param value the value to assert -- fails when not truthy
 * @param message an optional message to include in the error
 * @throws an `AssertionError` when `value` is falsy
 */
export function assert(value: boolean, message: string = ""): asserts value {
  if (!value) {
    throw new Error(`assertion failed${message ? `: ${message}` : ""}`);
  }
}

/**
 * A plain old JS object. Doesn't account for symbol or number keys for now.
 */
export type SimpleObject = Record<string, unknown>;

/**
 * Checks if the given `input` object is a plain old JS object.; also asserts
 * the same at the type level.
 *
 * @param input the object to check
 * @returns `true` if the object is simple; `false` otherwise
 */
export function isSimpleObject(input: object): input is SimpleObject {
  return input !== globalThis && input?.constructor === Object;
}
