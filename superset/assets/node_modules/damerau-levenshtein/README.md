[![NPM](https://nodei.co/npm/damerau-levenshtein.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/damerau-levenshtein/)

I use algorithm kindly provided by TheSpanishInquisition here: <http://jsperf.com/damerau-levenshtein-distance>.

All credits goes there. I have only packed it into Node module.

It provides a function that takes two string arguments and returns a hash like this:

```` javascript
{
  steps: 5,       // Levenstein demerau distance
  relative: 0.7,  // steps / length of the longer string
  similarity: 0.3 // 1 - relative
}
````

Please see [tests](./test/test.js) for more insights.
