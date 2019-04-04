discontinuous-range
===================

```
DiscontinuousRange(1, 10).subtract(4, 6); // [ 1-3, 7-10 ]
```

  [![Build Status](https://travis-ci.org/dtudury/discontinuous-range.png)](https://travis-ci.org/dtudury/discontinuous-range)

this is a pretty simple module, but it exists to service another project
so this'll be pretty lacking documentation. 
reading the test to see how this works may help.  otherwise, here's an example
that I think pretty much sums it up


###Example
```
var all_numbers = new DiscontinuousRange(1, 100);
var bad_numbers = DiscontinuousRange(13).add(8).add(60,80);
var good_numbers = all_numbers.clone().subtract(bad_numbers);
console.log(good_numbers.toString()); //[ 1-7, 9-12, 14-59, 81-100 ]
var random_good_number = good_numbers.index(Math.floor(Math.random() * good_numbers.length));
```
