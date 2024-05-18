# Patrim Cauthon

_Sa souvraya niende misain ye._

[Patrim](https://patrim.vein.io) is a goofy little term rewriting language, implemented
in Typescript. Incomplete documentation is available at the
[Patrim website](https://patrim.vein.io).

Patrim was inspired by [Modal](https://wiki.xxiivv.com/site/modal).

## Example

A simple program that prints "Hello, world!" 3 times:

```
// Define a symbol for the string "Hello, world!"
:: hello "Hello, world!"

// Repeat something `n` times.
:: (repeat 0 ?s) undefined
:: (repeat ?n:number ?s) (
  ?s ;
  repeat (?n - 1) ?s
)

// Define a shorthand for calling `console.info`. Note that `print` matches
// its argument eagerly.
:: (print !s) (((#global . console) . info) (?s))

repeat 3 (print hello)
```

Evaluating the program:

```bash
$ pc hello.pat

Hello, world!
Hello, world!
Hello, world!
```

## Installation

```
$ npm -g install patrim
```

## Usage

To evaluate the contents of a file or files, use `pc`:

```bash
$ pc [options] <file>...
```

The resulting rewritten term will be printed to `stdout`. Pass `--interactive` to open
an interactive session after evaluating the given files, if any:

```bash
$ pc --interactive
? :: hello "Hello, world!"
rule-36: hello => Hello, world!
? hello
'Hello, world!'
? #exit 0
$
```

For complete usage information, see `pc --help`.

## VS Code integration

See [patrim-vscode](https://marketplace.visualstudio.com/items?itemName=zachsnow.patrim-vscode)
for VS Code integration.
