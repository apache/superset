import {bandwidthNRD} from 'vega-statistics';
import {array, constant, error, isFunction, one} from 'vega-util';
import {sum} from 'd3-array';

function radius(bw, data, f) {
  const v = bw >= 0 ? bw : bandwidthNRD(data, f);
  return Math.round((Math.sqrt(4 * v * v + 1) - 1) / 2);
}

function number(_) {
  return isFunction(_) ? _ : constant(+_);
}

// Implementation adapted from d3/d3-contour. Thanks!
export default function() {
  var x = d => d[0],
      y = d => d[1],
      weight = one,
      bandwidth = [-1, -1],
      dx = 960,
      dy = 500,
      k = 2; // log2(cellSize)

  function density(data, counts) {
    const rx = radius(bandwidth[0], data, x) >> k, // blur x-radius
          ry = radius(bandwidth[1], data, y) >> k, // blur y-radius
          ox = rx ? rx + 2 : 0, // x-offset padding for blur
          oy = ry ? ry + 2 : 0, // y-offset padding for blur
          n = 2 * ox + (dx >> k), // grid width
          m = 2 * oy + (dy >> k), // grid height
          values0 = new Float32Array(n * m),
          values1 = new Float32Array(n * m);

    let values = values0;

    data.forEach(d => {
      const xi = ox + (+x(d) >> k),
            yi = oy + (+y(d) >> k);

      if (xi >= 0 && xi < n && yi >= 0 && yi < m) {
        values0[xi + yi * n] += +weight(d);
      }
    });

    if (rx > 0 && ry > 0) {
      blurX(n, m, values0, values1, rx);
      blurY(n, m, values1, values0, ry);
      blurX(n, m, values0, values1, rx);
      blurY(n, m, values1, values0, ry);
      blurX(n, m, values0, values1, rx);
      blurY(n, m, values1, values0, ry);
    } else if (rx > 0) {
      blurX(n, m, values0, values1, rx);
      blurX(n, m, values1, values0, rx);
      blurX(n, m, values0, values1, rx);
      values = values1;
    } else if (ry > 0) {
      blurY(n, m, values0, values1, ry);
      blurY(n, m, values1, values0, ry);
      blurY(n, m, values0, values1, ry);
      values = values1;
    }

    // scale density estimates
    // density in points per square pixel or probability density
    let s = counts ? Math.pow(2, -2 * k) : 1 / sum(values);
    for (let i=0, sz=n*m; i<sz; ++i) values[i] *= s;

    return {
      values: values,
      scale: 1 << k,
      width: n,
      height: m,
      x1: ox,
      y1: oy,
      x2: ox + (dx >> k),
      y2: oy + (dy >> k)
    };
  }

  density.x = function(_) {
    return arguments.length ? (x = number(_), density) : x;
  };

  density.y = function(_) {
    return arguments.length ? (y = number(_), density) : y;
  };

  density.weight = function(_) {
    return arguments.length ? (weight = number(_), density) : weight;
  };

  density.size = function(_) {
    if (!arguments.length) return [dx, dy];
    var _0 = +_[0], _1 = +_[1];
    if (!(_0 >= 0 && _1 >= 0)) error('invalid size');
    return dx = _0, dy = _1, density;
  };

  density.cellSize = function(_) {
    if (!arguments.length) return 1 << k;
    if (!((_ = +_) >= 1)) error('invalid cell size');
    k = Math.floor(Math.log(_) / Math.LN2);
    return density;
  };

  density.bandwidth = function(_) {
    if (!arguments.length) return bandwidth;
    _ = array(_);
    if (_.length === 1) _ = [+_[0], +_[0]];
    if (_.length !== 2) error('invalid bandwidth');
    return bandwidth = _, density;
  };

  return density;
}

function blurX(n, m, source, target, r) {
  const w = (r << 1) + 1;
  for (let j = 0; j < m; ++j) {
    for (let i = 0, sr = 0; i < n + r; ++i) {
      if (i < n) {
        sr += source[i + j * n];
      }
      if (i >= r) {
        if (i >= w) {
          sr -= source[i - w + j * n];
        }
        target[i - r + j * n] = sr / Math.min(i + 1, n - 1 + w - i, w);
      }
    }
  }
}

function blurY(n, m, source, target, r) {
  const w = (r << 1) + 1;
  for (let i = 0; i < n; ++i) {
    for (let j = 0, sr = 0; j < m + r; ++j) {
      if (j < m) {
        sr += source[i + j * n];
      }
      if (j >= r) {
        if (j >= w) {
          sr -= source[i + (j - w) * n];
        }
        target[i + (j - r) * n] = sr / Math.min(j + 1, m - 1 + w - j, w);
      }
    }
  }
}
