
function UniformDistribution(a, b) {
  if (!(this instanceof UniformDistribution)) {
    return new UniformDistribution(a, b);
  }

  if (typeof a !== 'number' && a !== undefined) {
    throw TypeError('mean must be a number');
  }
  if (typeof b !== 'number' && b !== undefined) {
    throw TypeError('sd must be a number');
  }

  this._a = typeof a === 'number' ? a : 0;
  this._b = typeof b === 'number' ? b : 1;

  if (this._b <= this._a) {
    throw new RangeError('a must be greater than b');
  }

  this._k = 1 / (this._b - this._a);
  this._mean = (this._a + this._b) / 2;
  this._var = (this._a - this._b) * (this._a - this._b) / 12;
}
module.exports = UniformDistribution;

UniformDistribution.prototype.pdf = function (x) {
  return (x < this._a || x > this._b) ? 0 : this._k;
};

UniformDistribution.prototype.cdf = function (x) {
  if (x < this._a) return 0;
  else if (x > this._b) return 1;
  else return (x - this._a) * this._k;
};

UniformDistribution.prototype.inv = function (p) {
  if (p < 0 || p > 1) return NaN;
  else return p * (this._b - this._a) + this._a;
};

UniformDistribution.prototype.median = function () {
  return this._mean;
};

UniformDistribution.prototype.mean = function () {
  return this._mean;
};

UniformDistribution.prototype.variance = function () {
  return this._var;
};
