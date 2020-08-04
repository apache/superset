import {error} from 'vega-util';

/**
 * Assigns a rank to an operator. Ranks are assigned in increasing order
 * by incrementing an internal rank counter.
 * @param {Operator} op - The operator to assign a rank.
 */
export function rank(op) {
  op.rank = ++this._rank;
}

/**
 * Re-ranks an operator and all downstream target dependencies. This
 * is necessary when upstream dependencies of higher rank are added to
 * a target operator.
 * @param {Operator} op - The operator to re-rank.
 */
export function rerank(op) {
  var queue = [op],
      cur, list, i;

  while (queue.length) {
    this.rank(cur = queue.pop());
    if (list = cur._targets) {
      for (i=list.length; --i >= 0;) {
        queue.push(cur = list[i]);
        if (cur === op) error('Cycle detected in dataflow graph.');
      }
    }
  }
}
