
var mathfn = require('mathfn');

function BinomialDistribution(properbility, size) {
  if (!(this instanceof BinomialDistribution)) {
    return new BinomialDistribution(properbility, size);
  }

  if (typeof properbility !== 'number') {
    throw TypeError('properbility must be a number');
  }
  if (typeof size !== 'number') {
    throw TypeError('size must be a number');
  }

  if (size <= 0.0) {
    throw TypeError('size must be positive');
  }
  if (properbility < 0.0 || properbility > 1) {
    throw TypeError('properbility must be between 0 and 1');
  }

  this._properbility = properbility;
  this._size = size;
}
module.exports = BinomialDistribution;

BinomialDistribution.prototype.pdf = function (x) {
  var n = this._size;
  var p = this._properbility;

  // choose(n, x)
  var binomialCoefficent = mathfn.gamma(n + 1) / (
    mathfn.gamma(x + 1) * mathfn.gamma(n - x + 1)
  )

  return binomialCoefficent * Math.pow(p, x) * Math.pow(1 - p, n - x);
};

BinomialDistribution.prototype.cdf = function (x) {
  return mathfn.incBeta(1 - this._properbility, this._size - x, x + 1);
};

BinomialDistribution.prototype.inv = function (p) {
  throw new Error('Inverse CDF of binomial distribution is not implemented');
};

BinomialDistribution.prototype.median = function () {
  return Math.round(this._properbility * this._size);
};

BinomialDistribution.prototype.mean = function () {
  return this._properbility * this._size;
};

BinomialDistribution.prototype.variance = function () {
  return this._properbility * this._size * (1 - this._properbility);
};
