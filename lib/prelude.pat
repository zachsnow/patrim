#add-rule (// ?...) () "comment"
// ^ A nicer syntax for comments.

// A nicer syntax for defining rules.
#add-rule (:: ?pattern ?replacement) (#add-rule ?pattern ?replacement) "::"
#add-rule (:: ?pattern ?replacement ?name:string) (#add-rule ?pattern ?replacement ?name)

// A nicer syntax for keying into objects and lists.
:: (!l . ?r:string) (#get ?l ?r) "object . property"
:: (!l . ?r:number) (#get ?l ?r) "object . number"

// A nicer syntax for calling functions and methods.
:: (?fn:function !...) (#call #global ?fn ?...)
:: (!object . ?method:string ?arguments:array) (#call (?object . ?method) ?object ?arguments)

// Test functions.
:: (assert !test) (assertAux ?test)
:: (assertAux true) ()
:: (assertAux false) (#throw "Assertion failed.")

:: (deny false) ()
:: (deny true) (#throw "Assertion failed.")
