import ols from './ols';
import {points, visitPoints} from './points';
import rSquared from './r-squared';

export default function(data, x, y) {
  // eslint-disable-next-line no-unused-vars
  const [xv, yv, ux, uy] = points(data, x, y);
  let YL = 0, XY = 0, XYL = 0, X2Y = 0, n = 0, dx, ly, xy;

  visitPoints(data, x, y, (_, dy) => {
    dx = xv[n++];
    ly = Math.log(dy);
    xy = dx * dy;

    YL += (dy * ly - YL) / n;
    XY += (xy - XY) / n;
    XYL += (xy * ly - XYL) / n;
    X2Y += (dx * xy - X2Y) / n;
  });

  const [c0, c1] = ols(XY / uy, YL / uy, XYL / uy, X2Y / uy),
        predict = x => Math.exp(c0 + c1 * (x - ux));

  return {
    coef: [Math.exp(c0 - c1 * ux), c1],
    predict: predict,
    rSquared: rSquared(data, x, y, uy, predict)
  };
}
