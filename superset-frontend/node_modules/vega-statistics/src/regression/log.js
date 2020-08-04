import ols from './ols';
import {visitPoints} from './points';
import rSquared from './r-squared';

// Adapted from d3-regression by Harry Stevens
// License: https://github.com/HarryStevens/d3-regression/blob/master/LICENSE
export default function(data, x, y) {
  let X = 0, Y = 0, XY = 0, X2 = 0, n = 0;

  visitPoints(data, x, y, (dx, dy) => {
    ++n;
    dx = Math.log(dx);
    X += (dx - X) / n;
    Y += (dy - Y) / n;
    XY += (dx * dy - XY) / n;
    X2 += (dx * dx - X2) / n;
  });

  const coef = ols(X, Y, XY, X2),
        predict = x => coef[0] + coef[1] * Math.log(x);

  return {
    coef: coef,
    predict: predict,
    rSquared: rSquared(data, x, y, Y, predict)
  };
}
