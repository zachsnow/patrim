import { assert, isSimpleObject } from "./util";

// TODO: would it be better to just use `[` and `]` for lists?
/** A token corresponding to a literal "(" */
export const BeginList = Symbol("BeginList");

/** A token corresponding to a literal ")" */
export const EndList = Symbol("EndList");

/** A token corresponding to a literal "{" */
export const BeginObject = Symbol("BeginObject");

/** A token corresponding to a literal "}" */
export const EndObject = Symbol("EndObject");

/** A token corresponding to a literal "\n" */
export const EndOfLine = Symbol("EndOfLine");

/** A token corresponding to the end of the input. */
export const EndOfInput = Symbol("EndOfInput");

/**
 * The (syntactic) type of tokens.
 */
export type Token =
  | typeof BeginList
  | typeof EndList
  | typeof BeginObject
  | typeof EndObject
  | typeof EndOfLine
  | typeof EndOfInput
  | Register
  | string
  | number
  | boolean
  | null
  | undefined;

export namespace Register {
  /**
   * The kind of binding to use; in general registers are lazy (`?reg`) but when
   * necessary -- usually when calling foreign functions -- we can eagerly evaluate
   * a term that matches a register (`!reg`) before instantiation.
   */
  export type Kind = "lazy" | "eager";
}

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
    public readonly kind: Register.Kind = "lazy",
  ) {}

  /**
   * Determines whether this register matches the given `input`.
   *
   * TODO: it would be nice if this lived in `evaluation.ts` instead; for now
   * we conflate parse-time registers and runtime registers.
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
          // Typescript doesn't narrow `input` because we saved it in a variable.
          assert(input !== undefined, "expected input");

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
export const reg = (name: string, type?: string, splat?: boolean, kind?: Register.Kind) =>
  new Register(name, type, splat, kind);

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

const SyntaxTokens: Record<string, Token> = {
  "(": BeginList,
  ")": EndList,
  "{": BeginObject,
  "}": EndObject,
  true: true,
  false: false,
  null: null,
  undefined: undefined,
};

/**
 * Lexes the given `input` string into a list of tokens. These tokens are either JS primitives
 * (e.g. `true`, `false`, strings, numbers, etc.), registers (e.g. `?x`, `!y:number` -- returned
 * as instances of `Register`), or unique symbols corresponding to various bits of syntax.
 *
 * @param input
 * @returns Token[]
 */
export const lex = (input: string): Token[] => {
  const Ignore = Symbol("Ignore");

  const matches = input.match(/[{}()]|"[^"\\]*(?:\\[\s\S][^"\\]*)*"|[^\s\(\)]+|\s+/g) || [];
  const tokens: (Token | typeof Ignore)[] = matches.map((token) => {
    // Ignore undefined matches.
    if (!token) {
      return Ignore;
    }

    // Most syntax (e.g. braces, true, false, etc.)
    if (token in SyntaxTokens) {
      return SyntaxTokens[token];
    }

    // Newlines are sometimes significant.
    if (token.includes("\n")) {
      return EndOfLine;
    }

    // Discard non-significant whitespace.
    token = token.trim();
    if (!token) {
      return Ignore;
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
 * Interpret escape sequences in `input`, so that e.g. `"\\n"` becomes `"\n"`.
 *
 * See: https://stackoverflow.com/a/57330383/25381 by T.J. Crowder.
 *
 * @param input
 * @returns the input string with escapes interpreted.
 */
const interpretEscapes = (input: string): string => {
  return input.replace(/\\["\bfnrtv0]/gi, (match) => {
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
      case "0":
        return "\0";
      default:
        // Should never match unless you change the regex and fail to update
        // the cases.
        return match.substring(1);
    }
  });
};

/**
 * @internal
 */
export class Tokenizer {
  private index: number = 0;
  constructor(private tokens: Token[]) {}

  /**
   * The current token; if the tokenizer is at or passed the end of input, returns `EndOfInput`.
   */
  public get current(): Token {
    if (this.index >= this.tokens.length) {
      return EndOfInput;
    }
    return this.tokens[this.index];
  }

  private next(): void {
    this.index++;
  }

  /**
   * Advance to the next token that does not match the given `token`.
   * @param token
   */
  public skip(token: Token): void {
    while (this.current === token) {
      this.next();
    }
  }

  /**
   * Consume and return the current token; advances to the next token. Optionally ensures
   * that the current token matches the given `token`, and raises `ParseError` if it does not.
   *
   * @param token the optional token to match
   * @returns the current token
   */
  public consume(token?: Token): Token {
    // We can't consume `undefined` explicitly but we don't need to, so oh well.
    const current = this.current;
    if (token !== undefined && current !== token) {
      throw new ParseError(`expected ${String(token)}`);
    }
    this.next();
    return current;
  }
}

/**
 * Base type for all parsing errors.
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Parses a single term from the given `tokenizer`.
 *
 * @param tokenizer the tokenizer to read tokens from
 * @returns the parsed `Term`
 */
const parseTerm = (tokenizer: Tokenizer): Term => {
  // Skip leading newlines.
  tokenizer.skip(EndOfLine);

  const token = tokenizer.consume();
  switch (token) {
    case BeginObject: {
      tokenizer.skip(EndOfLine);

      const term: { [K: string]: Term } = {};
      while ((tokenizer.current as Token) !== EndObject) {
        // Parse a key-value pair.
        const key = tokenizer.consume();
        if (typeof key !== "string") {
          throw new ParseError("expected string key in object");
        }
        const value = parseTerm(tokenizer);
        term[key] = value;

        // Skip trailing newlines between key-value pairs.
        tokenizer.skip(EndOfLine);
      }

      // Discard the trailing `}` and advance.
      tokenizer.consume();
      return term;
    }
    case EndObject:
      throw new ParseError("unexpected '}'");
    case BeginList: {
      tokenizer.skip(EndOfLine);

      const term = [];
      while ((tokenizer.current as Token) !== EndList) {
        term.push(parseTerm(tokenizer));

        // Skip trailing newlines between terms.
        tokenizer.skip(EndOfLine);
      }

      // Discard the trailing `)` and advance.
      tokenizer.consume();
      return term;
    }
    case EndList:
      throw new ParseError("unexpected ')'");
    case EndOfInput:
      throw new ParseError("unexpected end of input");
    default:
      return token;
  }
};

/**
 * Parses a single "line" from the program, ignoring newlines within parens.
 * @param tokenizer
 * @returns
 */
const parseLine = (tokenizer: Tokenizer): Term => {
  const terms: Term[] = [];
  while (true) {
    switch (tokenizer.current) {
      case BeginObject:
      case BeginList:
        terms.push(parseTerm(tokenizer));
        break;
      case EndObject:
        throw new ParseError("unexpected '}'");
      case EndList:
        throw new ParseError("unexpected ')'");
      case EndOfLine:
      case EndOfInput:
        tokenizer.consume();

        // Unwrap single terms automatically, so that e.g.
        // (1) parses to 1 and not [1].
        if (terms.length === 1) {
          return terms[0];
        }
        // Otherwise leave them wrapped, so we can write `1 2` to get `[1, 2]`.
        return terms;
      default:
        terms.push(tokenizer.current);
        tokenizer.consume();
        break;
    }
  }
};

const parseProgram = (tokenizer: Tokenizer): Program => {
  const program: Term[] = [];
  while (true) {
    // Skip empty lines.
    tokenizer.skip(EndOfLine);

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
