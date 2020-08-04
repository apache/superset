
//
// Modified from:
//  C++: http://www.johndcook.com/cpp_erf.html
//
var ERF_A = [
  0.254829592,
  -0.284496736,
  1.421413741,
  -1.453152027,
  1.061405429
];
var ERF_P = 0.3275911;

function erf(x) {
  var sign = 1;
  if (x < 0) sign = -1;

  x = Math.abs(x);

  var t = 1.0/(1.0 + ERF_P*x);
  var y = 1.0 - (((((ERF_A[4]*t + ERF_A[3])*t) + ERF_A[2])*t + ERF_A[1])*t + ERF_A[0])*t*Math.exp(-x*x);

  return sign * y;
}
exports.erf = erf;

//
// Combined from two sources:
//  Python: http://pydoc.net/Python/timbre/1.0.0/timbre.stats/
//  JavaScript: https://github.com/jstat/jstat/blob/master/src/special.js
//
var M_2_SQRTPI = 1.12837916709551257;

var ERFC_COF = [
  -2.8e-17, 1.21e-16, -9.4e-17, -1.523e-15, 7.106e-15,
   3.81e-16, -1.12708e-13, 3.13092e-13, 8.94487e-13,
  -6.886027e-12, 2.394038e-12, 9.6467911e-11,
  -2.27365122e-10, -9.91364156e-10, 5.059343495e-9,
   6.529054439e-9, -8.5238095915e-8, 1.5626441722e-8,
   1.303655835580e-6, -1.624290004647e-6,
  -2.0278578112534e-5, 4.2523324806907e-5,
   3.66839497852761e-4, -9.46595344482036e-4,
  -9.561514786808631e-3, 1.9476473204185836e-2,
   6.4196979235649026e-1, -1.3026537197817094
];
var ERFC_COF_LAST = ERFC_COF[ERFC_COF.length - 1];

function erfc(x) {
  function erfccheb(y) {
    var d = 0.0, dd = 0.0, temp = 0.0,
        t = 2.0 / (2.0 + y), ty = 4.0 * t - 2.0;
  
    for (var i = 0, l = ERFC_COF.length - 1; i < l; i++) {
      temp = d;
      d = ty * d - dd + ERFC_COF[i];
      dd = temp;
    }
  
    return t * Math.exp(-y * y + 0.5 * (ERFC_COF_LAST + ty * d) - dd);
  }
  
  return x >= 0.0 ? erfccheb(x) : 2.0 - erfccheb(-x);
}
exports.erfc = erfc;

//
// Combined from three sources:
//  Python: http://pydoc.net/Python/timbre/1.0.0/timbre.stats/
//  JavaScript: https://github.com/jstat/jstat/blob/master/src/special.js
//  C: https://github.com/Peteysoft/sea_ice/blob/master/src/mcc_ice/inverf.c
//
function invErfc(p) {
  if (p < 0.0 || p > 2.0) {
    throw RangeError('Argument must be betweeen 0 and 2');
  }

  else if (p === 0.0) {
    return Infinity;
  }
  
  else if (p === 2.0) {
    return -Infinity;
  }
  
  else {
    var pp = p < 1.0 ? p : 2.0 - p;
    var t = Math.sqrt(-2.0 * Math.log(pp / 2.0));
    var x = -0.70711 * ((2.30753 + t * 0.27061) / (1.0 + t * (0.99229 + t * 0.04481)) - t);

    var err1 = erfc(x) - pp;
    x += err1 / (M_2_SQRTPI * Math.exp(-x * x) - x * err1);
    var err2 = erfc(x) - pp;
    x += err2 / (M_2_SQRTPI * Math.exp(-x * x) - x * err2);

    return p < 1.0 ? x : -x;
  }
}
exports.invErfc = invErfc;

//
// Used math: inverf(x) = -inverfc(1 + x);
//  NOTE: you are welcome to add a specific approximation
//
function invErf(p) {
  if (p < -1.0 || p > 1.0) {
    throw RangeError('Argument must be betweeen -1 and 1');
  }

  return -invErfc(p + 1);
}
exports.invErf = invErf;
