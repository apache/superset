# vega-statistics

Statistical routines and probability distributions.

## API Reference

- [Random Number Generation](#random-number-generation)
- [Distribution Methods](#distribution-methods)
- [Distribution Objects](#distribution-objects)
- [Regression](#regression)
- [Statistics](#statistics)

### Random Number Generation

<a name="random" href="#random">#</a>
vega.<b>random</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/random.js "Source")

Returns a uniform pseudo-random number in the domain [0, 1). By default this is simply a call to JavaScript's built-in `Math.random` function. All Vega routines that require random numbers should use this function.

<a name="setRandom" href="#setRandom">#</a>
vega.<b>setRandom</b>(<i>randfunc</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/random.js "Source")

Sets the random number generator to the provided function _randfunc_. Subsequent calls to <a href="#random">random</a> will invoke the new function to generate random numbers. Setting a custom generator can be helpful if one wishes to use an alternative source of randomness or replace the default generator with a deterministic function for testing purposes.

<a name="randomLCG" href="#randomLCG">#</a>
vega.<b>randomLCG</b>(<i>seed</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/lcg.js "Source")

Returns a new random number generator with the given random _seed_. The returned function takes zero arguments and generates random values in the domain [0, 1) using a [linear congruential generator (LCG)](https://en.wikipedia.org/wiki/Linear_congruential_generator). This method is helpful in conjunction with [setRandom](#setRandom) to provide seeded random numbers for stable outputs and testing.

### Distribution Methods

Methods for sampling and calculating values for probability distributions.

<a name="sampleNormal" href="#sampleNormal">#</a>
vega.<b>sampleNormal</b>([<i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/normal.js "Source")

Returns a sample from a univariate [normal (Gaussian) probability distribution](https://en.wikipedia.org/wiki/Normal_distribution) with specified *mean* and standard deviation *stdev*. If unspecified, the mean defaults to `0` and the standard deviation defaults to `1`.

<a name="cumulativeNormal" href="#cumulativeNormal">#</a>
vega.<b>cumulativeNormal</b>(value[, <i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/normal.js "Source")

Returns the value of the [cumulative distribution function](https://en.wikipedia.org/wiki/Cumulative_distribution_function) at the given input domain *value* for a normal distribution with specified *mean* and standard deviation *stdev*. If unspecified, the mean defaults to `0` and the standard deviation defaults to `1`.

<a name="densityNormal" href="#densityNormal">#</a>
vega.<b>densityNormal</b>(value[, <i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/normal.js "Source")

Returns the value of the [probability density function](https://en.wikipedia.org/wiki/Probability_density_function) at the given input domain *value*, for a normal distribution with specified *mean* and standard deviation *stdev*. If unspecified, the mean defaults to `0` and the standard deviation defaults to `1`.

<a name="quantileNormal" href="#quantileNormal">#</a>
vega.<b>quantileNormal</b>(probability[, <i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/normal.js "Source")

Returns the quantile value (the inverse of the [cumulative distribution function](https://en.wikipedia.org/wiki/Cumulative_distribution_function)) for the given input *probability*, for a normal distribution with specified *mean* and standard deviation *stdev*. If unspecified, the mean defaults to `0` and the standard deviation defaults to `1`.

<a name="sampleLogNormal" href="#sampleLogNormal">#</a>
vega.<b>sampleLogNormal</b>([<i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/lognormal.js "Source")

Returns a sample from a univariate [log-normal probability distribution](https://en.wikipedia.org/wiki/Log-normal_distribution) with specified log *mean* and log standard deviation *stdev*. If unspecified, the log mean defaults to `0` and the log standard deviation defaults to `1`.

<a name="cumulativeLogNormal" href="#cumulativeNormal">#</a>
vega.<b>cumulativeLogNormal</b>(value[, <i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/lognormal.js "Source")

Returns the value of the [cumulative distribution function](https://en.wikipedia.org/wiki/Cumulative_distribution_function) at the given input domain *value* for a log-normal distribution with specified log *mean* and log standard deviation *stdev*. If unspecified, the log mean defaults to `0` and the log standard deviation defaults to `1`.

<a name="densityLogNormal" href="#densityLogNormal">#</a>
vega.<b>densityLogNormal</b>(value[, <i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/lognormal.js "Source")

Returns the value of the [probability density function](https://en.wikipedia.org/wiki/Probability_density_function) at the given input domain *value*, for a log-normal distribution with specified log *mean* and log standard deviation *stdev*. If unspecified, the log mean defaults to `0` and the log standard deviation defaults to `1`.

<a name="quantileLogNormal" href="#quantileLogNormal">#</a>
vega.<b>quantileLogNormal</b>(probability[, <i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/lognormal.js "Source")

Returns the quantile value (the inverse of the [cumulative distribution function](https://en.wikipedia.org/wiki/Cumulative_distribution_function)) for the given input *probability*, for a log-normal distribution with specified log *mean* and log standard deviation *stdev*. If unspecified, the log mean defaults to `0` and the log standard deviation defaults to `1`.

<a name="sampleUniform" href="#sampleUniform">#</a>
vega.<b>sampleUniform</b>([<i>min</i>, <i>max</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/uniform.js "Source")

Returns a sample from a univariate [continuous uniform probability distribution](https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)) over the interval [*min*, *max*). If unspecified, *min* defaults to `0` and *max* defaults to `1`. If only one argument is provided, it is interpreted as the *max* value.

<a name="cumulativeUniform" href="#cumulativeUniform">#</a>
vega.<b>cumulativeUniform</b>(value[, <i>min</i>, <i>max</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/uniform.js "Source")

Returns the value of the [cumulative distribution function](https://en.wikipedia.org/wiki/Cumulative_distribution_function) at the given input domain *value* for a uniform distribution over the interval [*min*, *max*). If unspecified, *min* defaults to `0` and *max* defaults to `1`. If only one argument is provided, it is interpreted as the *max* value.

<a name="densityUniform" href="#densityUniform">#</a>
vega.<b>densityUniform</b>(value[, <i>min</i>, <i>max</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/uniform.js "Source")

Returns the value of the [probability density function](https://en.wikipedia.org/wiki/Probability_density_function) at the given input domain *value*,  for a uniform distribution over the interval [*min*, *max*). If unspecified, *min* defaults to `0` and *max* defaults to `1`. If only one argument is provided, it is interpreted as the *max* value.

<a name="quantileUniform" href="#quantileUniform">#</a>
vega.<b>quantileUniform</b>(probability[, <i>min</i>, <i>max</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/uniform.js "Source")

Returns the quantile value (the inverse of the [cumulative distribution function](https://en.wikipedia.org/wiki/Cumulative_distribution_function)) for the given input *probability*,  for a uniform distribution over the interval [*min*, *max*). If unspecified, *min* defaults to `0` and *max* defaults to `1`. If only one argument is provided, it is interpreted as the *max* value.

### Distribution Objects

Objects representing probability distributions, with methods for sampling and calculating values. Each method takes a set of distributional parameters and returns a distribution object representing a random variable.

Distribution objects expose the following methods:

- dist.<b>sample</b>(): Samples a random value drawn from this distribution.
- dist.<b>pdf</b>(<i>value</i>): Calculates the value of the [probability density function](https://en.wikipedia.org/wiki/Probability_density_function) at the given input domain *value*.
- dist.<b>cdf</b>(<i>value</i>): Calculates the value of the [cumulative distribution function](https://en.wikipedia.org/wiki/Cumulative_distribution_function) at the given input domain *value*.
- dist.<b>icdf</b>(<i>probability</i>): Calculates the inverse of the [cumulative distribution function](https://en.wikipedia.org/wiki/Cumulative_distribution_function) for the given input *probability*.

<a name="randomNormal" href="#randomNormal">#</a>
vega.<b>randomNormal</b>([<i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/normal.js "Source")

Creates a distribution object representing a [normal (Gaussian) probability distribution](https://en.wikipedia.org/wiki/Normal_distribution) with specified *mean* and standard deviation *stdev*. If unspecified, the mean defaults to `0` and the standard deviation defaults to `1`.

Once created, *mean* and *stdev* values can be accessed or modified using the `mean` and `stdev` getter/setter methods.

<a name="randomLogNormal" href="#randomLogNormal">#</a>
vega.<b>randomLogNormal</b>([<i>mean</i>, <i>stdev</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/lognormal.js "Source")

Creates a distribution object representing a [log-normal probability distribution](https://en.wikipedia.org/wiki/Log-normal_distribution) with specified log *mean* and log standard deviation *stdev*. If unspecified, the log mean defaults to `0` and the log standard deviation defaults to `1`.

Once created, *mean* and *stdev* values can be accessed or modified using the `mean` and `stdev` getter/setter methods.

<a name="randomUniform" href="#randomUniform">#</a>
vega.<b>randomUniform</b>([<i>min</i>, <i>max</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/uniform.js "Source")

Creates a distribution object representing a [continuous uniform probability distribution](https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)) over the interval [*min*, *max*). If unspecified, *min* defaults to `0` and *max* defaults to `1`. If only one argument is provided, it is interpreted as the *max* value.

Once created, *min* and *max* values can be accessed or modified using the `min` and `max` getter/setter methods.

<a name="randomInteger" href="#randomInteger">#</a>
vega.<b>randomInteger</b>([<i>min</i>,] <i>max</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/integer.js "Source")

Creates a distribution object representing a [discrete uniform probability distribution](https://en.wikipedia.org/wiki/Discrete_uniform_distribution) over the integer domain [*min*, *max*). If only one argument is provided, it is interpreted as the *max* value. If unspecified, *min* defaults to `0`.

Once created, *min* and *max* values can be accessed or modified using the `min` and `max` getter/setter methods.

<a name="randomMixture" href="#randomMixture">#</a>
vega.<b>randomMixture</b>(<i>distributions</i>[, <i>weights</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/mixture.js "Source")

Creates a distribution object representing a (weighted) mixture of probability distributions. The *distributions* argument should be an array of distribution objects. The optional *weights* array provides proportional numerical weights for each distribution. If provided, the values in the *weights* array will be normalized to ensure that weights sum to 1. Any unspecified weight values default to `1` (prior to normalization). Mixture distributions do **not** support the `icdf` method: calling `icdf` will result in an error.

Once created, the *distributions* and *weights* arrays can be accessed or modified using the `distributions` and `weights` getter/setter methods.

<a name="randomKDE" href="#randomKDE">#</a>
vega.<b>randomKDE</b>(<i>values</i>[, <i>bandwidth</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/kde.js "Source")

Creates a distribution object representing a [kernel density estimate](https://en.wikipedia.org/wiki/Kernel_density_estimation) for an array of numerical *values*. This method uses a Gaussian kernel to estimate a smoothed, continuous probability distribution. The optional *bandwidth* parameter determines the width of the Gaussian kernel. If the *bandwidth* is either `0` or unspecified, a default bandwidth value will be automatically estimated based on the input data. KDE distributions do **not** support the `icdf` method: calling `icdf` will result in an error.

Once created, *data* and *bandwidth* values can be accessed or modified using the `data` and `bandwidth` getter/setter methods.

### Regression

Two-dimensional regression methods to predict one variable given another.

<a name="regressionLinear" href="#regressionLinear">#</a>
vega.<b>regressionLinear</b>(<i>data</i>, <i>x</i>, <i>y</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/regression/linear.js "Source")

Fit a linear regression model with functional form _y = a + b * x_ for the input *data* array and corresponding *x* and *y* accessor functions. Returns an object for the fit model parameters with the following properties:

- _coef_: An array of fitted coefficients of the form _[a, b]_.
- _predict_: A function that returns a regression prediction for an input _x_ value.
- _rSquared_: The R<sup>2</sup> [coefficient of determination](https://en.wikipedia.org/wiki/Coefficient_of_determination), indicating the amount of total variance of _y_ accounted for by the model.

<a name="regressionLog" href="#regressionLog">#</a>
vega.<b>regressionLog</b>(<i>data</i>, <i>x</i>, <i>y</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/regression/log.js "Source")

Fit a logarithmic regression model with functional form _y = a + b * log(x)_ for the input input *data* array and corresponding *x* and *y* accessor functions.

Returns an object for the fit model parameters with the following properties:

- _coef_: An array of fitted coefficients of the form _[a, b]_.
- _predict_: A function that returns a regression prediction for an input _x_ value.
- _rSquared_: The R<sup>2</sup> [coefficient of determination](https://en.wikipedia.org/wiki/Coefficient_of_determination), indicating the amount of total variance of _y_ accounted for by the model.

<a name="regressionExp" href="#regressionExp">#</a>
vega.<b>regressionExp</b>(<i>data</i>, <i>x</i>, <i>y</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/regression/exp.js "Source")

Fit an exponential regression model with functional form _y = a + e<sup>b * x</sup>_ for the input *data* array and corresponding *x* and *y* accessor functions. Returns an object for the fit model parameters with the following properties:

- _coef_: An array of fitted coefficients of the form _[a, b]_.
- _predict_: A function that returns a regression prediction for an input _x_ value.
- _rSquared_: The R<sup>2</sup> [coefficient of determination](https://en.wikipedia.org/wiki/Coefficient_of_determination), indicating the amount of total variance of _y_ accounted for by the model.

<a name="regressionPow" href="#regressionPow">#</a>
vega.<b>regressionPow</b>(<i>data</i>, <i>x</i>, <i>y</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/regression/pow.js "Source")

Fit a power law regression model with functional form _y = a * x<sup>b</sup>_ for the input *data* array and corresponding *x* and *y* accessor functions. Returns an object for the fit model parameters with the following properties:

- _coef_: An array of fitted coefficients of the form _[a, b]_.
- _predict_: A function that returns a regression prediction for an input _x_ value.
- _rSquared_: The R<sup>2</sup> [coefficient of determination](https://en.wikipedia.org/wiki/Coefficient_of_determination), indicating the amount of total variance of _y_ accounted for by the model.

<a name="regressionQuad" href="#regressionQuad">#</a>
vega.<b>regressionLinear</b>(<i>data</i>, <i>x</i>, <i>y</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/regression/quad.js "Source")

Fit a quadratic regression model with functional form _y = a + b * x + c * x<sup>2</sup>_ for the input *data* array and corresponding *x* and *y* accessor functions. Returns an object for the fit model parameters with the following properties:

- _coef_: An array of fitted coefficients of the form _[a, b, c]_,
- _predict_: A function that returns a regression prediction for an input _x_ value.
- _rSquared_: The R<sup>2</sup> [coefficient of determination](https://en.wikipedia.org/wiki/Coefficient_of_determination), indicating the amount of total variance of _y_ accounted for by the model.

<a name="regressionPoly" href="#regressionPoly">#</a>
vega.<b>regressionPoly</b>(<i>data</i>, <i>x</i>, <i>y</i>, <i>order</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/regression/poly.js "Source")

Fit a polynomial regression model of specified _order_ with functional form _y = a + b * x + ... + k * x<sup>order</sup>_ for the input *data* array and corresponding *x* and *y* accessor functions. Returns an object for the fit model parameters with the following properties:

- _coef_: An _(order + 1)_-length array of polynomial coefficients of the form _[a, b, c, d, ...]_.
- _predict_: A function that returns a regression prediction for an input _x_ value.
- _rSquared_: The R<sup>2</sup> [coefficient of determination](https://en.wikipedia.org/wiki/Coefficient_of_determination), indicating the amount of total variance of _y_ accounted for by the model.

<a name="regressionLoess" href="#regressionLoess">#</a>
vega.<b>regressionLoess</b>(<i>data</i>, <i>x</i>, <i>y</i>, <i>bandwidth</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/regression/loess.js "Source")

Fit a smoothed, non-parametric trend line the input *data* array and corresponding *x* and *y* accessor functions using _loess_ (locally-estimated scatterplot smoothing). Loess performs a sequence of local weighted regressions over a sliding window of nearest-neighbor points. The _bandwidth_ argument determines the size of the sliding window, expressed as a [0, 1] fraction of the total number of data points included.

<a name="sampleCurve" href="#sampleCurve">#</a>
vega.<b>sampleCurve</b>(<i>f</i>, <i>extent</i>[, <i>minSteps</i>, <i>maxSteps</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/sampleCurve.js "Source")

Generate sample points from an interpolation function _f_ for the provided domain _extent_ and return an array of _[x, y]_ points. Performs adaptive subdivision to dynamically sample more points in regions of higher curvature. Subdivision stops when the difference in angles between the current samples and a proposed subdivision falls below one-quarter of a degree. The optional _minSteps_ argument (default 25), determines the minimal number of initial, uniformly-spaced sample points to draw. The optional _maxSteps_ argument (default 200), indicates the maximum resolution at which adaptive sampling will stop, defined relative to a uniform grid of size _maxSteps_. If _minSteps_ and _maxSteps_ are identical, no adaptive sampling will be performed and only the initial, uniformly-spaced samples will be returned.

### Statistics

Statistical methods for bandwidth estimation, bin calculation, bootstrapped confidence intervals, and quartile boundaries.

<a name="bandwidthNRD" href="#bandwidthNRD">#</a>
vega.<b>bandwidthNRD</b>(<i>array</i>[, <i>accessor</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/bandwidth.js "Source")

Given an *array* of numeric values, estimates a bandwidth value for use in Gaussian kernel density estimation, assuming a normal reference distribution. The underlying formula (from Scott 1992) is 1.06 times the minimum of the standard deviation and the interquartile range divided by 1.34 times the sample size to the negative one-fifth power, along with special case handling in case of zero values for the interquartile range or deviation. An optional *accessor* function can be used to first extract numerical values from an array of input objects, and is equivalent to first calling `array.map(accessor)`.

<a name="bin" href="#bin">#</a>
vega.<b>bin</b>(<i>options</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/bin.js "Source")

Determine a quantitative binning scheme, for example to create a histogram. Based on the options provided given, this method will search over a space of possible bins, aligning step sizes with a given number base and applying constraints such as the maximum number of allowable bins. Given a set of options (see below), returns an object describing the binning scheme, in terms of `start`, `stop`, and `step` properties.

The supported options properties are:

- _extent_: (required) A two-element (`[min, max]`) array indicating the range over which the bin values are defined.
- _base_: The number base to use for automatic bin determination (default base `10`).
- _maxbins_: The maximum number of allowable bins (default `20`).
- _span_: The value span over which to generate bin boundaries. The default is `extent[1] - extent[0]`. This parameter allows automatic step size determination over custom spans (for example, a zoomed-in region) while retaining the overall _extent_.
- _step_: An exact step size to use between bins. If provided, the _maxbins_, _span_, and _steps_ options will be ignored.
- _steps_: An array of allowable step sizes to choose from. If provided, the _maxbins_ option will be ignored.
- _minstep_: A minimum allowable step size (particularly useful for integer values, default `0`).
- _divide_: An array of scale factors indicating allowable subdivisions. The default value is `[5, 2]`, which indicates that the method may consider dividing bin sizes by 5 and/or 2. For example, for an initial step size of 10, the method can check if bin sizes of 2 (= 10/5), 5 (= 10/2), or 1 (= 10/(5*2)) might also satisfy the given constraints.
- _nice_: Boolean indicating if the start and stop values should be nicely-rounded relative to the step size (default `true`).

```js
vega.bin({extent:[0, 1], maxbins:10}); // {start:0, stop:1, step:0.1}
vega.bin({extent:[0, 1], maxbins:5}); // {start:0, stop:10, step:2}
vega.bin({extent:[5, 10], maxbins:5}); // {start:5, stop:10, step:1}
```

<a name="bootstrapCI" href="#bootstrapCI">#</a>
vega.<b>bootstrapCI</b>(<i>array</i>, <i>samples</i>, <i>alpha</i>[, <i>accessor</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/bootstrapCI.js "Source")

Calculates a [bootstrapped](https://en.wikipedia.org/wiki/Bootstrapping_(statistics)) [confidence interval](https://en.wikipedia.org/wiki/Confidence_interval) for an input *array* of values, based on a given number of *samples* iterations and a target *alpha* value. For example, an *alpha* value of `0.05` corresponds to a 95% confidence interval An optional *accessor* function can be used to first extract numerical values from an array of input objects, and is equivalent to first calling `array.map(accessor)`. This method ignores null, undefined, and NaN values.

<a name="dotbin" href="#dotbin">#</a>
vega.<b>dotbin</b>(<i>sortedArray</i>, <i>step</i>[, <i>smooth</i>, <i>accessor</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/dotbin.js "Source")

Calculates [dot plot](https://en.wikipedia.org/wiki/Dot_plot_%28statistics%29) bin locations for an input *sortedArray* of numerical values, and returns an array of bin locations with indices matching the input *sortedArray*. This method implements the ["dot density" algorithm of Wilkinson, 1999](https://www.cs.uic.edu/~wilkinson/Publications/dotplots.pdf). The *step* parameter determines the bin width: points within *step* values of an anchor point will be assigned the same bin location. The optional *smooth* parameter is a boolean value indicating if the bin locations should additionally be smoothed to reduce variance. An optional *accessor* function can be used to first extract numerical values from an array of input objects, and is equivalent to first calling `array.map(accessor)`. Any null, undefined, or NaN values should be removed prior to calling this method.

<a name="quantiles" href="#quartiles">#</a>
vega.<b>quantiles</b>(<i>array</i>, <i>p</i>[, <i>accessor</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/quartiles.js "Source")

Given an *array* of numeric values and array *p* of probability thresholds in the range [0, 1], returns an array of p-[quantiles](https://en.wikipedia.org/wiki/Quantile). The return value is a array the same length as the input *p*. An optional *accessor* function can be used to first extract numerical values from an array of input objects, and is equivalent to first calling `array.map(accessor)`. This method ignores null, undefined and NaN values.

<a name="quartiles" href="#quartiles">#</a>
vega.<b>quartiles</b>(<i>array</i>[, <i>accessor</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-statistics/src/quartiles.js "Source")

Given an *array* of numeric values, returns an array of [quartile](https://en.wikipedia.org/wiki/Quartile) boundaries. The return value is a 3-element array consisting of the first, second (median), and third quartile boundaries. An optional *accessor* function can be used to first extract numerical values from an array of input objects, and is equivalent to first calling `array.map(accessor)`. This method ignores null, undefined and NaN values.
