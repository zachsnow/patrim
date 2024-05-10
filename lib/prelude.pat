#add-rule (// ?*rest) undefined
// ^ A nicer syntax for comments.

// A nicer syntax for defining rules.
#add-rule (:: ?pattern ?replacement) (#add-rule ?pattern ?replacement) "::"
#add-rule (:: ?pattern ?replacement ?name:string) (#add-rule ?pattern ?replacement ?name) ":: (named)"

// A nicer syntax for binding names to eagerly evaluated values
:: (?pattern:string := !replacement) (:: ?pattern ?replacement) ":="

// A nicer syntax for keying into objects and lists.
:: (!l . ?r:string) (#get ?l ?r) "object . property"
:: (!l . ?r:number) (#get ?l ?r) "object . number"
:: (!l . ?r:string ?*rest) ((#get ?l ?r) ?*rest) "object . property ..."
:: (!l . ?r:number ?*rest) ((#get ?l ?r) ?*rest) "object . number ..."

// Sequencing.
:: (!l ; ) undefined "; (implicit trailing undefined)"
:: (!l ; ?*rest) (?*rest) ";"


// Repeat something `n` times.
:: (repeat 0 ?s) undefined
:: (repeat ?n:number ?s) (
  ?s ;
  repeat (?n - 1) ?s
)


// Test functions.
:: (assert !test) (assertAux ?test)
:: (assertAux true) ()
:: (assertAux false) (#throw "Assertion failed.")
:: (assertAux ?test) (#throw "Invalid assertion: expected boolean")

:: (deny !test) (assert (! ?test))
