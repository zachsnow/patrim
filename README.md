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

```
$ pnpm run pc hello.pat

Hello, world!
Hello, world!
Hello, world!
```

## Installation

```
cd patrim
pnpm i
```

## Usage

To evaluate the contents of a file or files, use `pc`:

```
$ pnpm run pc <file> <file> ...
```

The resulting rewritten term will be printed to `stdout`. Pass `--interactive` to open
a REPL after evaluating the given files, if any:

```
$ pnpm run pc --interactive
patrim ? :: hello "Hello, world!"
```

For complete usage information, use `pnpm run pc --help`.
