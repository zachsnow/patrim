/**
 * An assertion that also applies at the type level.
 */
export function assert(value: boolean, message: string = ""): asserts value {
  if (!value) {
    throw new Error(`assertion failed${message ? `: ${message}` : ""}`);
  }
}

export type SimpleObject = Record<string, unknown>;

export function isSimpleObject(input: object): input is SimpleObject {
  return input?.constructor === Object;
};

