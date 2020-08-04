import {visitPoints} from './points';

// Adapted from d3-regression by Harry Stevens
// License: https://github.com/HarryStevens/d3-regression/blob/master/LICENSE
export default function(data, x, y, uY, predict) {
  let SSE = 0, SST = 0;

  visitPoints(data, x, y, (dx, dy) => {
    const sse = dy - predict(dx),
          sst = dy - uY;

    SSE += sse * sse;
    SST += sst * sst;
  });

  return 1 - SSE / SST;
}
