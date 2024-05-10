// The Ackermann function. Don't run anything higher than `ack 3 4` if you want
// to see the result in a reasonable amount of time.
:: (ack 0 ?n:number) (?n + 1)
:: (ack ?m:number 0) (ack (?m - 1) 1)
:: (ack ?m:number ?n:number) (ack (?m - 1) (ack ?m (?n - 1)))

ack 2 3
