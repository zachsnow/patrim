import * as fs from "fs";
import path from "path";
import { start } from "repl";
import { Context, execute, parse } from "../src";
import { Builtins, CoreBuiltins } from "../src/builtins";

const BIN = "patrim cauthon";

process.on("unhandledRejection", (reason, p) => {
  console.error("${BIN}: unhandled rejection", reason, p);
});

process.on("uncaughtException", (err) => {
  console.error(`${BIN}: error:`, err);
  process.exit(-1);
});

async function startRepl(debug: boolean, context: Context) {
  debug && console.debug(`${BIN}: starting interactive mode...`);
  const server = start({
    prompt: `? `,
    eval: (cmd, ctx, filename, callback) => {
      try {
        const program = parse(cmd);
        const result = execute(program, context);
        callback(null, result);
      } catch (e) {
        callback(e instanceof Error ? e : new Error(`${e}`), null);
      }
    },
  });
  const promise = new Promise<void>((resolve) => {
    server.on("exit", () => {
      debug && console.debug(`${BIN}: interactive mode exiting...`);
      resolve();
    });
  });
  return promise;
}

async function main() {
  // Exclude the first two arguments: node and the script itself.
  let args = process.argv.slice(2);

  const noPrelude = args.includes("--no-prelude");
  const debug = args.includes("--debug");
  const interactive = args.includes("--interactive");
  const noDefaultBuiltins = args.includes("--no-default-builtins");
  const noBuiltins = args.includes("--no-builtins");
  const showDerivation = args.includes("--show-derivation");

  if (debug) {
    console.debug(`${BIN}: debug mode enabled`);
  }
  if (noPrelude) {
    debug && console.debug(`${BIN}: skipping prelude...`);
  }

  // Get passed filenames.
  args = args.filter((arg) => !arg.startsWith("--"));

  // If no files are provided and we aren't entering a repl, print usage and exit.
  if (args.length === 0 && !interactive) {
    console.info(`${BIN}: no files to read.`);
    console.info("usage: pc [--no-prelude] <file1> <file2> ...");
    process.exit(-1);
  }

  // Include the prelude unless --no-prelude is passed.
  const filenames = noPrelude ? args : [path.join(__dirname, "../lib/prelude.pat"), ...args];

  // Read all files and concatenate them into a single program.
  const content = filenames
    .map((filename) => {
      debug && console.debug(`${BIN}: reading file:`, filename);
      return fs.readFileSync(filename, "utf8");
    })
    .join("\n");

  try {
    // Parse the program and execute it.
    debug && console.debug(`${BIN}: read files:`, content);

    const program = parse(content);
    debug && console.debug(`${BIN}: parsed program:`, program);

    // Create a context so we can pass it to interactive mode if needed; that way
    // rules defined in the program can be used interactively.
    const context = new Context(noBuiltins ? [] : noDefaultBuiltins ? CoreBuiltins : Builtins);
    const result = execute(program, context);

    if (interactive) {
      await startRepl(debug, context);
      return;
    }

    // Otherwise, by default we print the final result.
    if (typeof result !== "undefined") {
      console.info(`${BIN}:`, result);
    }

    // Optionally show all derivations.
    if (showDerivation) {
      console.info(`${BIN}: derivations:\n  ${context.derivations.join("\n  ")}`);
    }

    debug && console.debug(`${BIN}: done.`);
    process.exit(0);
  } catch (e) {
    console.error(`${BIN}: error:`, e);
    process.exit(-1);
  }
}

main();
