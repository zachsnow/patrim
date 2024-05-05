(#add-rule (// ?...) (#drop ?...))
(// ^ comments!)

(// A nicer syntax for defining rules.)
(#add-rule (<> ?l ?r) (#drop (#add-rule ?l ?r)))

(// A nicer syntax for keying into objects and lists.)
(#add-rule (!l . ?r:string) (#get ?l ?r))
(#add-rule (!l . ?r:number) (#get ?l ?r))
