:: (?l:number !) (
  (:: (fac 0 ?n:number) ?n) ;
  (:: (fac ?n:number ?m:number) (fac (?n - 1) (?n * ?m))) ;
  (fac ?l 1)
)
3 !
