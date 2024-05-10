:: (bottle 0) "no more bottles of beer"
:: (bottle 1) "1 bottle of beer"
:: (bottle ?n:number) (?n + " bottles of beer")

:: (beer 0) (#print 😭)
:: (beer ?n:number) (
  (#print (((bottle ?n) + " on the wall, ") + (bottle ?n))) ;
  (#print "take one down, pass it around") ;
  (#print ((bottle (?n - 1)) + " on the wall")) ;
  (beer (?n - 1)) ;
)

beer 3
