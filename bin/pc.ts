import fs from "fs";
import os from "os";
import path from "path";
import { env } from "process";
import { Recoverable, start } from "repl";
import { parseArgs } from "util";
import { Context, execute, parse, ParseError } from "../src";
import { Builtins, CoreBuiltins } from "../src/builtins";

const BIN = "patrim cauthon";

let debug = false;

process.on("unhandledRejection", (reason, p) => {
  console.error("${BIN}: unhandled rejection", reason, p);
});

process.on("uncaughtException", (err) => {
  console.error(`${BIN}: error:`, err);
  process.exit(-1);
});

async function interactive(context: Context, history?: string) {
  debug && console.debug(`${BIN}: starting interactive mode...`);
  const server = start({
    prompt: `? `,
    eval: (cmd, ctx, filename, callback) => {
      try {
        const program = parse(cmd);
        const result = execute(program, context);
        callback(null, result);
      } catch (e) {
        if (e instanceof ParseError && e.incomplete) {
          callback(new Recoverable(e), null);
        } else {
          callback(e instanceof Error ? e : new Error(`${e}`), null);
        }
      }
    },
  });

  history ??= path.join(os.homedir(), ".patrim-history");
  if (history) {
    debug && console.debug(`${BIN}: loading history from ${history}...`);
    server.setupHistory(history, () => {
      debug && console.debug(`${BIN}: history loaded...`);
    });
  }

  const promise = new Promise<void>((resolve) => {
    server.on("exit", () => {
      debug && console.debug(`${BIN}: interactive mode exiting...`);
      resolve();
    });
  });
  return promise;
}

const parseArgsConfig = {
  // Exclude the first two arguments: node and the script itself.
  args: process.argv.slice(2),
  options: {
    interactive: {
      type: "boolean",
      default: false,
      short: "i",
      description: "start an interactive session",
    },
    history: {
      type: "string",
      short: "H",
      description: "path to the history file for interactive mode",
    },
    showDerivation: {
      type: "boolean",
      default: false,
      description: "show final derivation",
    },
    noPrelude: {
      type: "boolean",
      default: false,
      description: "do not include the prelude",
    },
    noBuiltins: {
      type: "boolean",
      default: false,
      description: "do not include built-in rules",
    },
    debug: {
      type: "boolean",
      default: false,
      description: "enable debug mode",
    },
    version: {
      type: "boolean",
      default: false,
      short: "v",
      description: "show version information",
    },
    help: {
      type: "boolean",
      default: false,
      short: "h",
      description: "show this help message",
    },
  },
  allowPositionals: true,
} as const;

function help() {
  console.info(`Usage: ${BIN} [options] <file>...`);
  console.info(`Options:`);
  Object.entries(parseArgsConfig.options).forEach(([name, option]) => {
    const short = "short" in option ? `-${option.short}, ` : "";
    const prefix = `  ${short}--${name}`;
    console.info(`${prefix}${" ".repeat(26 - prefix.length)}${option.description ?? ""}`);
  });
  console.info("");
}

function parseOptions() {
  return parseArgs(parseArgsConfig);
}

function version() {
  const version = env.npm_package_version;
  console.info(`${BIN}: version ${version ?? "unknown"}`);
}

async function main(): Promise<number | undefined> {
  const allOptions = parseOptions();
  const options = allOptions.values;
  const filenames = allOptions.positionals;

  debug = options.debug ?? false;
  if (debug) {
    console.debug(`${BIN}: debug mode enabled`);
  }
  if (options.noPrelude) {
    debug && console.debug(`${BIN}: skipping prelude...`);
  }

  if (options.help) {
    help();
    return;
  }

  if (options.version) {
    version();
    return;
  }

  // If no files are provided and we aren't entering a repl, print usage and exit.
  if (filenames.length === 0 && !options.interactive) {
    console.error(`${BIN}: no files to read.`);
    help();
    return -1;
  }

  // Include the prelude unless --no-prelude is passed.
  if (!options.noPrelude) {
    filenames.unshift(path.join(__dirname, "../lib/prelude.pat"));
  }

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
    if (options.noBuiltins) {
      debug && console.debug(`${BIN}: skipping builtins...`);
    }
    const context = new Context(options.noBuiltins ? CoreBuiltins : Builtins);
    const result = execute(program, context);

    if (options.interactive) {
      await interactive(context, options.history);
      return;
    }

    // Otherwise, by default we print the final result.
    if (typeof result !== "undefined") {
      console.info(`${BIN}:`, result);
    }

    // Optionally show all derivations.
    if (options.showDerivation) {
      console.info(`${BIN}: derivations:\n  ${context.derivations.join("\n  ")}`);
    }

    debug && console.debug(`${BIN}: done.`);
    return;
  } catch (e) {
    console.error(`${BIN}: error:`, e);
    return -1;
  }
}

main()
  .then((i) => {
    process.exit(i ?? 0);
  })
  .catch((e) => {
    console.error(`${BIN}: unhandled error:`, e);
    process.exit(-1);
  });
