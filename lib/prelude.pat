#add-rule (// ?*rest) undefined
// ^ A nicer syntax for comments.

// A nicer syntax for defining rules.
#add-rule (:: ?pattern ?replacement) (#add-rule ?pattern ?replacement) "::"
#add-rule (:: ?pattern ?replacement ?name:string) (#add-rule ?pattern ?replacement ?name) ":: (named)"

// A nicer syntax for keying into objects and lists.
:: (!l . ?r:string) (#get ?l ?r) "object . property"
:: (!l . ?r:number) (#get ?l ?r) "object . number"

// Sequencing.
:: (!l ; ?*rest) (?*rest)

// Test functions.
:: (assert !test) (assertAux ?test)
:: (assertAux true) ()
:: (assertAux false) (#throw "Assertion failed.")
:: (assertAux ?test) (#throw "Invalid assertion: expected boolean")

:: (deny !test) (assert (! ?test))
