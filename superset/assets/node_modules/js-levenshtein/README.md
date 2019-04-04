# js-levenshtein [![Build Status](https://travis-ci.org/gustf/js-levenshtein.svg?branch=master)](https://travis-ci.org/gustf/js-levenshtein)

A very efficient JS implementation calculating the Levenshtein distance, i.e. the difference between two strings.

Based on Wagner-Fischer dynamic programming algorithm, optimized for speed and memory
 - use a single distance vector instead of a matrix
 - loop unrolling on the outer loop
 - remove common prefixes/postfixes from the calculation
 - minimize the number of comparisons
 
## Install

```
$ npm install --save js-levenshtein
```


## Usage

```js
const levenshtein = require('js-levenshtein');

levenshtein('kitten', 'sitting');
//=> 3
```


## Benchmark

```
$ npm run bench
  
                      50 paragraphs, length max=500 min=240 avr=372.5
             152 op/s » js-levenshtein
              97 op/s » talisman
              93 op/s » levenshtein-edit-distance
              83 op/s » leven
              38 op/s » fast-levenshtein

                      100 sentences, length max=170 min=6 avr=57.5
           2,858 op/s » js-levenshtein
           1,916 op/s » talisman
           1,759 op/s » levenshtein-edit-distance
           1,578 op/s » leven
             784 op/s » fast-levenshtein

                      2000 words, length max=20 min=3 avr=9.5
           2,776 op/s » js-levenshtein
           2,359 op/s » talisman
           2,184 op/s » levenshtein-edit-distance
           1,878 op/s » leven
           1,268 op/s » fast-levenshtein
```

Benchmarks was performed with node v8.12.0 on a MacBook Pro 15", 2.9 GHz Intel Core i9

## License

MIT © Gustaf Andersson