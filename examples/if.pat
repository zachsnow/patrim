:: (if !r ?then ?else) (ifAux ?r ?then ?else)
:: (if !r ?then) (ifAux ?r ?then undefined)

:: (ifAux true ?then ?else) ?then
:: (ifAux false ?then ?else) ?else
:: (ifAux ?r ?then ?else) (#throw "Expected a boolean.")
