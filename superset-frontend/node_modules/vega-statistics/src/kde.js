import estimateBandwidth from './bandwidth';
import gaussian from './normal';
import {random} from './random';

// TODO: support for additional kernels?
export default function(support, bandwidth) {
  var kernel = gaussian(),
      dist = {},
      n = 0;

  dist.data = function(_) {
    if (arguments.length) {
      support = _;
      n = _ ? _.length : 0;
      return dist.bandwidth(bandwidth);
    } else {
      return support;
    }
  };

  dist.bandwidth = function(_) {
    if (!arguments.length) return bandwidth;
    bandwidth = _;
    if (!bandwidth && support) bandwidth = estimateBandwidth(support);
    return dist;
  };

  dist.sample = function() {
    return support[~~(random() * n)] + bandwidth * kernel.sample();
  };

  dist.pdf = function(x) {
    for (var y=0, i=0; i<n; ++i) {
      y += kernel.pdf((x - support[i]) / bandwidth);
    }
    return y / bandwidth / n;
  };

  dist.cdf = function(x) {
    for (var y=0, i=0; i<n; ++i) {
      y += kernel.cdf((x - support[i]) / bandwidth);
    }
    return y / n;
  };

  dist.icdf = function() {
    throw Error('KDE icdf not supported.');
  };

  return dist.data(support);
}
