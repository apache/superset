import {isString} from 'vega-util';
import {LogicalComposition} from '../logical';
import {fieldFilterExpression, isSelectionPredicate, Predicate} from '../predicate';
import {logicalExpr} from '../util';
import {DataFlowNode} from './data/dataflow';
import {Model} from './model';
import {parseSelectionPredicate} from './selection/parse';

/**
 * Converts a predicate into an expression.
 */
// model is only used for selection filters.
export function expression(model: Model, filterOp: LogicalComposition<Predicate>, node?: DataFlowNode): string {
  return logicalExpr(filterOp, (predicate: Predicate) => {
    if (isString(predicate)) {
      return predicate;
    } else if (isSelectionPredicate(predicate)) {
      return parseSelectionPredicate(model, predicate.selection, node);
    } else {
      // Filter Object
      return fieldFilterExpression(predicate);
    }
  });
}
