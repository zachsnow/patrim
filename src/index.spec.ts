import {
  BeginTerm,
  Context,
  EndOfLine,
  EndTerm,
  evaluate,
  instantiate,
  lex,
  match,
  parse,
  reg,
  Register,
  Strategy,
  subterms,
} from ".";

const collect = (term: unknown, strategy?: Strategy): unknown[] => {
  return Array.from(subterms(term, new Context([], strategy))).map((subterm) => subterm.term);
};

const value = (term: unknown): unknown => {
  const result = evaluate(term);
  if (Array.isArray(result)) {
    return result[result.length - 1];
  }
  throw new Error("expected array");
};

describe("lex", () => {
  test("lex", () => {
    expect(lex("1")).toEqual([1]);
    expect(lex("1\n2")).toEqual([1, EndOfLine, 2]);
    expect(lex("1\n\n2")).toEqual([1, EndOfLine, 2]);
    expect(lex("1 \n 2")).toEqual([1, EndOfLine, 2]);
    expect(lex("1 \t 2")).toEqual([1, 2]);
    expect(lex("hi")).toEqual(["hi"]);
    expect(lex("1 ( hi ?r a)")).toEqual([1, BeginTerm, "hi", reg("r"), "a", EndTerm]);
    expect(lex("(1)")).toEqual([BeginTerm, 1, EndTerm]);
    expect(lex("(1 hello)")).toEqual([BeginTerm, 1, "hello", EndTerm]);
    expect(lex("true")).toEqual([true]);
    expect(lex("false")).toEqual([false]);
    expect(lex("null")).toEqual([null]);
    expect(lex("undefined")).toEqual([undefined]);
  });

  test("quoted strings", () => {
    expect(lex('"hi"')).toEqual(["hi"]);
    expect(lex('a "hi there"')).toEqual(["a", "hi there"]);
    expect(lex('a "hi \\"there\\"" 1')).toEqual(["a", 'hi "there"', 1]);
  });
});

fdescribe("parse", () => {
  test("valid primitives", () => {
    // Primitives.
    expect(parse("1")).toEqual([1]);
    expect(parse("1.5")).toEqual([1.5]);
    expect(parse("hi")).toEqual(["hi"]);
    expect(parse("true")).toEqual([true]);
    expect(parse("false")).toEqual([false]);
    expect(parse("null")).toEqual([null]);
    expect(parse("undefined")).toEqual([undefined]);
  });

  test("implicit outer term", () => {
    expect(parse("1 2")).toEqual([1, 2]);
    expect(parse("1 2 \n hi")).toEqual([[1, 2], "hi"]);
    expect(parse("1 \n 2")).toEqual([1, 2]);
  });

  test("valid structured values", () => {
    expect(parse("(1)")).toEqual([[1]]);
    expect(parse("(1 2)")).toEqual([[1, 2]]);
    expect(parse("(1 \n 2)")).toEqual([[1, 2]]);

    expect(parse("(1 hello)")).toEqual([1, "hello"]);
  });

  test("invalid", () => {
    expect(() => parse("( 1")).toThrow();
    expect(() => parse("1 )")).toThrow();
  });
});

describe("match", () => {
  test("primitives", () => {
    expect(match(1, 1)).toEqual({});
    expect(match(1, 2)).toBeNull();
    expect(match(1, null)).toBeNull();
    expect(match(null, null)).toEqual({});
    expect(match(null, 1)).toBeNull();
    expect(match(true, true)).toEqual({});
    expect(match(true, false)).toBeNull();
    expect(match("a", "a")).toEqual({});
    expect(match("a", "b")).toBeNull();

    const sym = Symbol("sym");
    const otherSym = Symbol("other");
    expect(match(sym, sym)).toEqual({});
    expect(match(sym, otherSym)).toBeNull();

    expect(match(undefined, undefined)).toEqual({});
    expect(match(undefined, null)).toBeNull();

    const f = () => {};
    const g = () => {};
    expect(match(f, f)).toEqual({});
    expect(match(f, g)).toBeNull();
    expect(match(f, null)).toBeNull();
  });

  test("arrays", () => {
    expect(match([], [])).toEqual({});
    expect(match([], [1])).toBeNull();
    expect(match([1], [1])).toEqual({});
    expect(match([1], [2])).toBeNull();
    expect(match([1], null)).toBeNull();
    expect(match([1], [])).toBeNull();
    expect(match([1], [1, 2])).toBeNull();
    expect(match([1, 2], [1, 2])).toEqual({});
    expect(match([1, 2], [1, 3])).toBeNull();
    expect(match([1, 2], [1])).toBeNull();
    expect(match([1, 2], [2])).toBeNull();
  });

  test("objects", () => {
    expect(match({}, {})).toEqual({});
    expect(match({}, { a: 1 })).toEqual({});
    expect(match({ a: 1 }, { a: 1 })).toEqual({});
    expect(match({ a: 1 }, { a: 2 })).toBeNull();
    expect(match({ a: 1 }, { a: 1, b: 2 })).toEqual({});
  });

  test("registers", () => {
    expect(match(reg("a"), 1)).toEqual({ a: 1 });
    expect(match([reg("a"), reg("b")], [1, 2])).toEqual({ a: 1, b: 2 });
    expect(match([reg("a"), reg("a")], [1, 1])).toEqual({ a: 1 });
    expect(match([reg("a"), reg("a")], [1, 2])).toBeNull();
  });
});

describe("instantiate", () => {
  test("primitives", () => {
    expect(instantiate(1, {})).toBe(1);
    expect(instantiate(null, {})).toBe(null);
    expect(instantiate(undefined, {})).toBe(undefined);
  });

  test("registers", () => {
    expect(instantiate(reg("a"), { a: { value: 1 } })).toBe(1);
    expect(instantiate([reg("a"), reg("b")], { a: { value: 1 }, b: { value: 2 } })).toEqual([1, 2]);
    expect(instantiate([reg("a"), reg("a")], { a: { value: 1 } })).toEqual([1, 1]);
  });
});

describe("subterms", () => {
  test("primitives", () => {
    expect(collect(1)).toEqual([1]);
    expect(collect(null)).toEqual([null]);
    expect(collect(undefined)).toEqual([undefined]);
  });

  test("arrays", () => {
    expect(collect([])).toEqual([[]]);

    expect(collect([1, 2])).toEqual([[1, 2], 1, 2]);
    expect(collect([1, 2], "innermost-leftmost")).toEqual([1, 2, [1, 2]]);

    expect(collect([1, [2, 3]])).toEqual([[1, [2, 3]], 1, [2, 3], 2, 3]);
    expect(collect([1, [2, 3]], "innermost-leftmost")).toEqual([1, 2, 3, [2, 3], [1, [2, 3]]]);
  });

  test("objects", () => {
    expect(collect({})).toEqual([{}]);
    expect(collect({ a: 1 })).toEqual([{ a: 1 }, 1]);
    expect(collect({ a: 1 }, "innermost-leftmost")).toEqual([1, { a: 1 }]);
    expect(collect({ a: 1, b: { c: 2 } })).toEqual([{ a: 1, b: { c: 2 } }, 1, { c: 2 }, 2]);
    expect(collect({ a: 1, b: { c: 2 } }, "innermost-leftmost")).toEqual([
      1,
      2,
      { c: 2 },
      { a: 1, b: { c: 2 } },
    ]);
  });

  test("rewrite", () => {
    const a = [1, 2];
    const location = Array.from(subterms(a, new Context()))[1].location;
    expect(location).not.toBeUndefined();
    expect(location!.object).toBe(a);
    expect(location!.key).toBe(0);
  });
});

describe("evaluate", () => {
  test("primitives", () => {
    expect(evaluate(1)).toBe(1);
    expect(evaluate(null)).toBe(null);
    expect(evaluate(undefined)).toBe(undefined);
  });

  test("simple rules", () => {
    expect(evaluate([1, 1], new Context([{ pattern: 1, replacement: 2 }]))).toEqual([2, 2]);
    expect(
      evaluate(
        ["hi", 1],
        new Context([{ pattern: ["hi", reg("a")], replacement: ["hello", reg("a")] }]),
      ),
    ).toEqual(["hello", 1]);
  });

  test("foreign", () => {
    expect(evaluate(1, new Context([{ pattern: 1, replacement: [() => 2] }]))).toBe(2);
  });

  test("#add-rule", () => {
    expect(value([["#add-rule", 1, "Hello!"], 1])).toBe("Hello!");
  });

  test("#remove-rule", () => {
    expect(value([["#remove-rule", ["#add-rule", 1, "Hello!"]]])).toBe([true]);
  });
});

describe("Register", () => {
  test("equality", () => {
    expect(reg("a")).toEqual(reg("a"));
    expect(reg("a")).not.toEqual(reg("b"));
    expect(reg("a")).not.toEqual(reg("a", "number"));
    expect(reg("a", "number")).toEqual(reg("a", "number"));
    expect(reg("a", "number", false, "eager")).toEqual(reg("a", "number", false, "lazy"));
  });

  test("parse", () => {
    expect(Register.parse("?a")).toEqual(reg("a"));
    expect(Register.parse("?abc")).toEqual(reg("abc"));
    expect(Register.parse("?a:number")).toEqual(reg("a", "number"));
  });
});

describe("end-to-end", () => {
  test("arithmetic", () => {
    expect(
      value(
        parse(`
      (1 + (2 * 3))
    `),
      ),
    ).toBe(7);
  });

  test("factorial", () => {
    expect(
      value(
        parse(`
      (#add-rule (factorial 0) 1)
      (#add-rule (factorial ?n:number) (?n * (factorial (?n - 1))))

      (factorial 3)
    `),
      ),
    ).toBe(6);
  });
});
