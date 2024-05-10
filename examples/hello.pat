// Define a symbol for the string "Hello, world!"
hello := "Hello, world!"

// Repeat something `n` times.
:: (repeat 0 ?s) undefined
:: (repeat ?n:number !s) (repeat (?n - 1) ?s)

// Define a shorthand for calling `console.info`. Note that `print` matches
// its argument eagerly.
:: (print !s) (#global . console . info (?s))

repeat 3 (print hello)
