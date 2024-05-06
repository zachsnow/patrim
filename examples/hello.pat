// Define a symbol for the string "Hello, world!"
:: hello "Hello, world!" "hello"

// Define a shorthand for calling `console.info`.
:: (print !s) (((#global . console) . info) (?s)) "print"

(print hello)
