
var gammaCollection = require('./gamma.js');
var log1p = require('./log.js').log1p;

//
// The beta functions are taken from the jStat library, and modified to fit
// the API and style pattern used in this module.
// See: https://github.com/jstat/jstat/
// License: MIT
//

//Copyright (c) 2013 jStat
//
//Permission is hereby granted, free of charge, to any person obtaining a copy
//of this software and associated documentation files (the "Software"), to deal
//in the Software without restriction, including without limitation the rights
//to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//copies of the Software, and to permit persons to whom the Software is
//furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in
//all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//THE SOFTWARE.

function beta(x, y) {
	if (x < 0 || y < 0) {
   throw RangeError('Arguments must be positive.');
	}

  // Some special cases
  else if (x === 0 && y === 0) return NaN;
  else if (x === 0 || y === 0) return Infinity;

	// make sure x + y doesn't exceed the upper limit of usable values
  else if (x + y > 170) {
    return Math.exp(gammaCollection.betaln(x, y));
  }

  else {
    return gammaCollection.gamma(x) * gammaCollection.gamma(y) / gammaCollection.gamma(x + y);
  }
}
exports.beta = beta;

function logBeta(x, y) {
  if (x < 0 || y < 0) {
   throw RangeError('Arguments must be positive.');
	}

  // Some special cases
  else if (x === 0 && y === 0) return NaN;
  else if (x === 0 || y === 0) return Infinity;

  else {
    return gammaCollection.logGamma(x) + gammaCollection.logGamma(y) - gammaCollection.logGamma(x + y);
  }
}
exports.logBeta = logBeta;

// evaluates the continued fraction for incomplete beta function by modified Lentz's method.
function betacf(x, a, b) {
	var fpmin = 1e-30,
		m = 1,
		m2, aa, c, d, del, h, qab, qam, qap;
	// These q's will be used in factors that occur in the coefficients
	qab = a + b;
	qap = a + 1;
	qam = a - 1;
	c = 1;
	d = 1 - qab * x / qap;
	if (Math.abs(d) < fpmin) d = fpmin;
	d = 1 / d;
	h = d;
	for (; m <= 100; m++) {
		m2 = 2 * m;
		aa = m * (b - m) * x / ((qam + m2) * (a + m2));
		// One step (the even one) of the recurrence
		d = 1 + aa * d;
		if (Math.abs(d) < fpmin) d = fpmin;
		c = 1 + aa / c;
		if (Math.abs(c) < fpmin) c = fpmin;
		d = 1 / d;
		h *= d * c;
		aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
		// Next step of the recurrence (the odd one)
		d = 1 + aa * d;
		if (Math.abs(d) < fpmin) d = fpmin;
		c = 1 + aa / c;
		if (Math.abs(c) < fpmin) c = fpmin;
		d = 1 / d;
		del = d * c;
		h *= del;
		if (Math.abs(del - 1.0) < 3e-7) break;
	}
	return h;
}

// Returns the incomplete beta function I_x(a,b)
function regualizedBeta(x, a, b) {
	if(x < 0 || x > 1) {
    throw new RangeError('First argument must be between 0 and 1.');
	}

  // Special cases, there can make trouble otherwise
  else if (a === 1 && b === 1) return x;
  else if (x === 0) return 0;
  else if (x === 1) return 1;
  else if (a === 0) return 1;
  else if (b === 0) return 0;

  else {
    var bt =
      Math.exp(gammaCollection.logGamma(a + b) -
      gammaCollection.logGamma(a) -
      gammaCollection.logGamma(b) +
      a * Math.log(x) +
      b * log1p(-x));

    // Use continued fraction directly.
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
    // else use continued fraction after making the symmetry transformation.
    else return 1 - bt * betacf(1 - x, b, a) / b;
  }
}
function incBeta(x, a, b) {
	return regualizedBeta(x, a, b) * beta(a, b);
}
exports.incBeta = incBeta;

// Returns the inverse of the incomplete beta function
function invIncBeta(p, a, b) {
  if(x < 0 || x > 1) {
    throw new RangeError('First argument must be between 0 and 1.');
	}

  // Special cases, there can make trouble otherwise
  else if (a === 1 && b === 1) return p;
  else if (p === 1) return 1;
  else if (p === 0) return 0;
  else if (a === 0) return 0;
  else if (b === 0) return 1;

  else {
    var EPS = 1e-8,
        a1 = a - 1,
        b1 = b - 1,
        j = 0,
        lna, lnb, pp, t, u, err, x, al, h, w, afac;

	if(a >= 1 && b >= 1) {
    pp = (p < 0.5) ? p : 1 - p;
    t = Math.sqrt(-2 * Math.log(pp));

		x = (2.30753 + t * 0.27061) / (1 + t* (0.99229 + t * 0.04481)) - t;
		if(p < 0.5) x = -x;
		al = (x * x - 3) / 6;
		h = 2 / (1 / (2 * a - 1)  + 1 / (2 * b - 1));
		w = (x * Math.sqrt(al + h) / h) - (1 / (2 * b - 1) - 1 / (2 * a - 1)) * (al + 5 / 6 - 2 / (3 * h));
		x = a / (a + b * Math.exp(2 * w));
	} else {
		lna = Math.log(a / (a + b));
		lnb = Math.log(b / (a + b));
		t = Math.exp(a * lna) / a;
		u = Math.exp(b * lnb) / b;
		w = t + u;
		if (p < t / w) x = Math.pow(a * w * p, 1 / a);
		else x = 1 - Math.pow(b * w * (1 - p), 1 / b);
	}

	afac = -gammaCollection.logGamma(a) - gammaCollection.logGamma(b) + gammaCollection.logGamma(a + b);

  for(; j < 10; j++) {
		if(x === 0 || x === 1) return x;
		err = regualizedBeta(x, a, b) - p;

    t = Math.exp(a1 * Math.log(x) + b1 * log1p(-x) + afac);
		u = err / t;
		x -= (t = u / (1 - 0.5 * Math.min(1, u * (a1 / x - b1 / (1 - x)))));

    if (x <= 0) x = 0.5 * (x + t);
		if (x >= 1) x = 0.5 * (x + t + 1);

		if (Math.abs(t) < EPS * x && j > 0) break;
	}

	return x;
  }
}
exports.invIncBeta = invIncBeta;
