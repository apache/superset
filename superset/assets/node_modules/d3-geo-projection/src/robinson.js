import "projection";

var robinsonConstants = [
  [0.9986, -0.062],
  [1.0000, 0.0000],
  [0.9986, 0.0620],
  [0.9954, 0.1240],
  [0.9900, 0.1860],
  [0.9822, 0.2480],
  [0.9730, 0.3100],
  [0.9600, 0.3720],
  [0.9427, 0.4340],
  [0.9216, 0.4958],
  [0.8962, 0.5571],
  [0.8679, 0.6176],
  [0.8350, 0.6769],
  [0.7986, 0.7346],
  [0.7597, 0.7903],
  [0.7186, 0.8435],
  [0.6732, 0.8936],
  [0.6213, 0.9394],
  [0.5722, 0.9761],
  [0.5322, 1.0000]
];

robinsonConstants.forEach(function(d) {
  d[1] *= 1.0144;
});

function robinson(λ, φ) {
  var i = Math.min(18, Math.abs(φ) * 36 / π),
      i0 = Math.floor(i),
      di = i - i0,
      ax = (k = robinsonConstants[i0])[0],
      ay = k[1],
      bx = (k = robinsonConstants[++i0])[0],
      by = k[1],
      cx = (k = robinsonConstants[Math.min(19, ++i0)])[0],
      cy = k[1],
      k;
  return [
    λ * (bx + di * (cx - ax) / 2 + di * di * (cx - 2 * bx + ax) / 2),
    (φ > 0 ? halfπ : -halfπ) * (by + di * (cy - ay) / 2 + di * di * (cy - 2 * by + ay) / 2)
  ];
}

robinson.invert = function(x, y) {
  var yy = y / halfπ,
      φ = yy * 90,
      i = Math.min(18, Math.abs(φ / 5)),
      i0 = Math.max(0, Math.floor(i));
  do {
    var ay = robinsonConstants[i0][1],
        by = robinsonConstants[i0 + 1][1],
        cy = robinsonConstants[Math.min(19, i0 + 2)][1],
        u = cy - ay,
        v = cy - 2 * by + ay,
        t = 2 * (Math.abs(yy) - by) / u,
        c = v / u,
        di = t * (1 - c * t * (1 - 2 * c * t));
    if (di >= 0 || i0 === 1) {
      φ = (y >= 0 ? 5 : -5) * (di + i);
      var j = 50, δ;
      do {
        i = Math.min(18, Math.abs(φ) / 5);
        i0 = Math.floor(i);
        di = i - i0;
        ay = robinsonConstants[i0][1];
        by = robinsonConstants[i0 + 1][1];
        cy = robinsonConstants[Math.min(19, i0 + 2)][1];
        φ -= (δ = (y >= 0 ? halfπ : -halfπ) * (by + di * (cy - ay) / 2 + di * di * (cy - 2 * by + ay) / 2) - y) * degrees;
      } while (Math.abs(δ) > ε2 && --j > 0);
      break;
    }
  } while (--i0 >= 0);
  var ax = robinsonConstants[i0][0],
      bx = robinsonConstants[i0 + 1][0],
      cx = robinsonConstants[Math.min(19, i0 + 2)][0];
  return [
    x / (bx + di * (cx - ax) / 2 + di * di * (cx - 2 * bx + ax) / 2),
    φ * radians
  ];
};

(d3.geo.robinson = function() { return projection(robinson); }).raw = robinson;
