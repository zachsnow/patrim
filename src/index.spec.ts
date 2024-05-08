import { execute } from ".";
import { Context, instantiate, match, rule, subterms } from "./evaluate";
import {
  BeginList,
  BeginObject,
  EndList,
  EndObject,
  EndOfInput,
  EndOfLine,
  lex,
  parse,
  reg,
} from "./parse";

const collect = (term: unknown, strategy?: Context.Strategy): unknown[] => {
  return Array.from(subterms(term, new Context([], strategy))).map((subterm) => subterm.term);
};

describe("lex", () => {
  test("lex", () => {
    expect(lex("")).toEqual([EndOfInput]);
    expect(lex("1")).toEqual([1, EndOfInput]);
    expect(lex("1\n2")).toEqual([1, EndOfLine, 2, EndOfInput]);
    expect(lex("1\n\n2")).toEqual([1, EndOfLine, 2, EndOfInput]);
    expect(lex("1 \n 2")).toEqual([1, EndOfLine, 2, EndOfInput]);
    expect(lex("1 \t 2")).toEqual([1, 2, EndOfInput]);
    expect(lex("hi")).toEqual(["hi", EndOfInput]);
    expect(lex("1 ( hi ?r a)")).toEqual([1, BeginList, "hi", reg("r"), "a", EndList, EndOfInput]);
    expect(lex("true { foo baz }")).toEqual([
      true,
      BeginObject,
      "foo",
      "baz",
      EndObject,
      EndOfInput,
    ]);
    expect(lex("(1)\n")).toEqual([BeginList, 1, EndList, EndOfLine, EndOfInput]);
    expect(lex("(1 hello)")).toEqual([BeginList, 1, "hello", EndList, EndOfInput]);
    expect(lex("true")).toEqual([true, EndOfInput]);
    expect(lex("false")).toEqual([false, EndOfInput]);
    expect(lex("null")).toEqual([null, EndOfInput]);
    expect(lex("undefined")).toEqual([undefined, EndOfInput]);
  });

  test("registers", () => {
    expect(lex("?a")[0]).toEqual(reg("a"));
    expect(lex("?abc")[0]).toEqual(reg("abc"));
    expect(lex("?a:number")[0]).toEqual(reg("a", "number"));
    expect(lex("!a")[0]).toEqual(reg("a", undefined, false, "eager"));
  });

  test("quoted strings", () => {
    expect(lex('"hi"')).toEqual(["hi", EndOfInput]);
    expect(lex('a "hi there"')).toEqual(["a", "hi there", EndOfInput]);
    expect(lex('a "hi \\"there\\"" 1')).toEqual(["a", 'hi "there"', 1, EndOfInput]);
  });
});

describe("parse", () => {
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

  test("structured values", () => {
    expect(parse("(1)")).toEqual([[1]]);
    expect(parse("( 1 )")).toEqual([[1]]);
    expect(parse("(1 2)")).toEqual([[1, 2]]);
    expect(parse("(1 \n 2)")).toEqual([[1, 2]]);
    expect(parse("(1 (hello world))")).toEqual([[1, ["hello", "world"]]]);
  });

  test("whitespace", () => {
    expect(parse("")).toEqual([]);
    expect(parse(" \t\n")).toEqual([]);
    expect(parse("\n\n ")).toEqual([]);
  });

  test("valid programs", () => {
    expect(
      parse(`
        1 2
    `),
    ).toEqual([[1, 2]]);
    expect(
      parse(`
      (1 2)
    `),
    ).toEqual([[1, 2]]);
    expect(
      parse(`
        1 2
        hi
    `),
    ).toEqual([[1, 2], "hi"]);
    expect(
      parse(`
        1 2
        (hi)
    `),
    ).toEqual([[1, 2], ["hi"]]);

    expect(
      parse(`
        1 2
        hello world
        (3 4)

        true
    `),
    ).toEqual([[1, 2], ["hello", "world"], [3, 4], true]);
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
    expect(match(reg("a"), 1)).toEqual({ a: { value: 1 } });
    expect(match([reg("a"), reg("b")], [1, 2])).toEqual({
      a: { value: 1 },
      b: { value: 2 },
    });
    expect(match([reg("a"), reg("a")], [1, 1])).toEqual({ a: { value: 1 } });
    expect(match([reg("a"), reg("a")], [1, 2])).toBeNull();
  });

  test("splats", () => {
    expect(match([reg("s", undefined, true)], [1, 2, 3])).toEqual({
      s: {
        value: [1, 2, 3],
        splat: true,
      },
    });

    expect(match([1, reg("s", undefined, true)], [1, 2, 3])).toEqual({
      s: {
        value: [2, 3],
        splat: true,
      },
    });

    expect(match([1, 2, 3, reg("s", undefined, true)], [1, 2, 3])).toEqual({
      s: {
        value: [],
        splat: true,
      },
    });

    expect(match([reg("s", undefined, true)], [])).toEqual({
      s: {
        value: [],
        splat: true,
      },
    });
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
    expect(execute([1])).toEqual(1);
    expect(execute([null])).toEqual(null);
    expect(execute([undefined])).toEqual(undefined);
  });

  test("simple rules", () => {
    expect(execute([[1, 1]], new Context([rule(1, 2)]))).toEqual([2, 2]);
    expect(execute([[1, "hi"]], new Context([rule(1, 2)]))).toEqual([2, "hi"]);
    expect(
      execute([["hi", 1]], new Context([rule(["hi", reg("a")], ["hello", reg("a")])])),
    ).toEqual(["hello", 1]);
  });

  test("#add-rule", () => {
    expect(execute([["#add-rule", 1, "Hello!"], 1])).toBe("Hello!");
  });

  test("#remove-rule", () => {
    expect(execute([["#remove-rule", ["#add-rule", 1, "Hello!"]]])).toBe(true);
  });
});

describe("end-to-end", () => {
  test("exceptions", () => {
    expect(() => execute(parse(`#throw "some error"`))).toThrow("some error");
    expect(execute(parse(`#try "hi"`))).toEqual("hi");
    expect(execute(parse(`#try (#throw "some error")`))).toEqual("some error");
  });

  test("arithmetic", () => {
    expect(
      execute(
        parse(`
          (1 + (2 * 3))
        `),
      ),
    ).toBe(7);
  });

  test("factorial", () => {
    expect(
      execute(
        parse(`
          (#add-rule (factorial 0) 1)
          (#add-rule (factorial ?n:number) (?n * (factorial (?n - 1))))

          (factorial 3)
        `),
      ),
    ).toBe(6);
  });
});
