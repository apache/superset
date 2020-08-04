/* 
 * range (Array)
 *   + start (Number) - the start index (incl.)
 *   + end (Number) - the end index (excl.)
 * rangeList (Array) - array of sorted, combined ranges
 */
export const EMPTY = [];
export const FULL = [[0, Infinity]];

// Insert a range into a range collection
export function add(rangeList, range) {
  // Noop if range collection already covers all
  if (rangeList === FULL) {
    return rangeList;
  }

  // Validate the input range
  if (range[0] < 0) {
    range[0] = 0;
  }
  if (range[0] >= range[1]) {
    return rangeList;
  }

  // TODO - split off to tree-shakable Range class
  const newRangeList = [];
  const len = rangeList.length;
  let insertPosition = 0;

  for (let i = 0; i < len; i++) {
    const range0 = rangeList[i];

    if (range0[1] < range[0]) {
      // the current range is to the left of the new range
      newRangeList.push(range0);
      insertPosition = i + 1;
    } else if (range0[0] > range[1]) {
      // the current range is to the right of the new range
      newRangeList.push(range0);
    } else {
      range = [Math.min(range0[0], range[0]), Math.max(range0[1], range[1])];
    }
  }
  newRangeList.splice(insertPosition, 0, range);
  return newRangeList;
}
