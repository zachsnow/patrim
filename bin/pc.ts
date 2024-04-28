import * as fs from "fs";
import { evaluate, parse } from "../src";

const BIN = "patrim cauthon";

process.on("unhandledRejection", (reason, p) => {
  console.error("${BIN}: unhandled rejection", reason, p);
});

process.on("uncaughtException", (err) => {
  console.error(`${BIN}: error:`, err);
  process.exit(-1);
});

async function main() {
  const args = process.argv.slice(2);

  const noPrelude = args.includes("--no-prelude");
  args.splice(args.indexOf("--no-prelude"), 1);
  if (args.length === 0) {
    console.info(`${BIN}: no files to read.`);
    console.info("usage: pc [--no-prelude] <file1> <file2> ...");
    process.exit(-1);
  }

  const filenames = noPrelude ? args : ["../lib/prelude.pat", ...args];
  if (noPrelude) {
    console.debug(`${BIN}: skipping prelude...`);
  }

  const content = filenames
    .map((filename) => {
      console.debug(`${BIN}: reading file:`, filename);
      return fs.readFileSync(filename, "utf8");
    })
    .join("\n");
  console.debug(`${BIN}: content:`, content);

  const term = parse(content);
  console.debug(`${BIN}: parsed term:`, term);

  const result = evaluate(term);
  console.debug(`${BIN}: evaluated term:`, result);

  console.info(`${BIN}: done.`);
  process.exit(0);
}

main();
