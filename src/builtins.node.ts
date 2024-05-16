import fs from "fs";
import { constants } from "./builtins";
import { Context, evaluateTerms, Rule, rule } from "./evaluate";
import { parse, reg } from "./parse";

let outputElement: HTMLElement | undefined;

export const IOBuiltins: Rule[] = [
  ...constants({
    "#read": (filename: string) => fs.readFileSync(filename, "utf8"),
    "#write": (filename: string, value: string) => fs.writeFileSync(filename, value),
    "#print": (value: any) => console.info(value),
  }),

  rule(
    ["#include", reg("filename", "string")],
    [
      function (this: Context, filename: string) {
        const content = fs.readFileSync(filename, "utf8");
        const program = parse(content);
        evaluateTerms(program, this);
      },
      [reg("filename")],
    ],
  ),
];

export const bindOutput = (node: HTMLElement) => {
