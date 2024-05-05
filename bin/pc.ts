import * as fs from "fs";
import path from "path";
import { execute, parse } from "../src";

const BIN = "patrim cauthon";

process.on("unhandledRejection", (reason, p) => {
  console.error("${BIN}: unhandled rejection", reason, p);
});

process.on("uncaughtException", (err) => {
  console.error(`${BIN}: error:`, err);
  process.exit(-1);
});

async function main() {
  // Exclude the first two arguments: node and the script itself.
  let args = process.argv.slice(2);

  const noPrelude = args.includes("--no-prelude");
  const debug = args.includes("--debug");

  if (debug) {
    console.debug(`${BIN}: debug mode enabled`);
  }
  if (noPrelude) {
    debug && console.debug(`${BIN}: skipping prelude...`);
  }

  // Get passed filenames.
  args = args.filter((arg) => !arg.startsWith("--"));

  // If no files are provided, print usage and exit.
  if (args.length === 0) {
    console.info(`${BIN}: no files to read.`);
    console.info("usage: pc [--no-prelude] <file1> <file2> ...");
    process.exit(-1);
  }

  // Include the prelude unless --no-prelude is passed.
  const filenames = noPrelude ? args : [path.join(__dirname, "../lib/prelude.pat"), ...args];

  // Read all files and concatenate them into a single program.
  const content = filenames
    .map((filename) => {
      console.debug(`${BIN}: reading file:`, filename);
      return fs.readFileSync(filename, "utf8");
    })
    .join("\n");

  try {
    // Parse the program and execute it.
    const program = parse(content);
    const result = execute(program);

    // By default we print the final result.
    console.info(`${BIN}:`, result);

    debug && console.debug(`${BIN}: done.`);
    process.exit(0);
  } catch (e) {
    console.error(`${BIN}: error:`, e);
    process.exit(-1);
  }
}

main();
