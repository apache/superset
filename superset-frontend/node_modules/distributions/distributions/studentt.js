
var mathfn = require('mathfn');

function StudenttDistribution(df) {
  if (!(this instanceof StudenttDistribution)) {
    return new StudenttDistribution(df);
  }

  if (typeof df !== 'number') {
    throw TypeError('mean must be a number');
  }
  if (df <= 0) {
    throw RangeError('df must be a positive number');
  }

  this._df = df;

  this._pdf_const = (mathfn.gamma((df + 1) / 2) / (Math.sqrt(df * Math.PI) * mathfn.gamma(df / 2)));
  this._pdf_exp = -((df + 1) / 2);

  this._df_half = df / 2;
}
module.exports = StudenttDistribution;

StudenttDistribution.prototype.pdf = function (x) {
  return this._pdf_const * Math.pow(1 + ((x*x) / this._df), this._pdf_exp);
};

StudenttDistribution.prototype.cdf = function (x) {
  var fac = Math.sqrt(x * x + this._df);

  return mathfn.incBeta((x + fac) / (2 * fac), this._df_half, this._df_half);
};

StudenttDistribution.prototype.inv = function (p) {
  var fac = mathfn.invIncBeta(2 * Math.min(p, 1 - p), this._df_half, 0.5);
  var y = Math.sqrt(this._df * (1 - fac) / fac);
  return (p > 0.5) ? y : -y;
};

StudenttDistribution.prototype.median = function () {
  return 0;
};

StudenttDistribution.prototype.mean = function () {
  return (this._df > 1) ? 0 : undefined;
};

StudenttDistribution.prototype.variance = function () {
  if (this._df > 2) return this._df / (this._df - 2);
  else if (this._df > 1) return Infinity;
  else return undefined;
};
