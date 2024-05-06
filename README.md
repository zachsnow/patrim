# Patrim Cauthon

_Sa souvraya niende misain ye._

Patrim is a goofy little term rewriting language, inspired by [Modal](https://wiki.xxiivv.com/site/modal).
Unlike the minimal and beautiful Modal, however, this implementation is intended to integrate
reasonably well with Javascript. It supports the various Javascript primitives, arrays, and
objects, and allows "extern" calls to existing Javascript functions.

For instance, this program:

```
:: (fac 0) 1
:: (fac ?n:number) (?n * (fac (?n - 1)))
The factorial of 3 is (fac 3)
```

Evaluates to:

```
The factorial of 3 is 6
```

## Usage

To evaluate the contents of a file, use `pc`:

```
$ pnpm run pc <file>
```

The resulting rewritten term will be printed to `stdout`.

## Syntax

The syntax of Patrim is generally inspired by Modal's but adds support for various Javascript
values -- numbers, quoted strings, `true`, `false`, `null`, `undefined`.

## Registers

Like Modal, rules can contain _registers_ that bind subterms. By default, simple registers (of the
form `?a` or `?foo`, for instance) match any term. They can be restricted to instead match only
terms of a particular primitive type -- `?n:number` -- or terms of a particular prototype --
`?node:DOMNode`.
