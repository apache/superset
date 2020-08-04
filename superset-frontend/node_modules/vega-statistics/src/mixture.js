import {random} from './random';

export default function(dists, weights) {
  var dist = {}, m = 0, w;

  function normalize(x) {
    var w = [], sum = 0, i;
    for (i=0; i<m; ++i) { sum += (w[i] = (x[i]==null ? 1 : +x[i])); }
    for (i=0; i<m; ++i) { w[i] /= sum; }
    return w;
  }

  dist.weights = function(_) {
    if (arguments.length) {
      w = normalize(weights = (_ || []));
      return dist;
    }
    return weights;
  };

  dist.distributions = function(_) {
    if (arguments.length) {
      if (_) {
        m = _.length;
        dists = _;
      } else {
        m = 0;
        dists = [];
      }
      return dist.weights(weights);
    }
    return dists;
  };

  dist.sample = function() {
    var r = random(),
        d = dists[m-1],
        v = w[0],
        i = 0;

    // first select distribution
    for (; i<m-1; v += w[++i]) {
      if (r < v) { d = dists[i]; break; }
    }
    // then sample from it
    return d.sample();
  };

  dist.pdf = function(x) {
    for (var p=0, i=0; i<m; ++i) {
      p += w[i] * dists[i].pdf(x);
    }
    return p;
  };

  dist.cdf = function(x) {
    for (var p=0, i=0; i<m; ++i) {
      p += w[i] * dists[i].cdf(x);
    }
    return p;
  };

  dist.icdf = function() {
    throw Error('Mixture icdf not supported.');
  };

  return dist.distributions(dists).weights(weights);
}
