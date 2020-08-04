import {isOperator} from './util';
import {error} from 'vega-util';

/**
 * Parse a dataflow operator.
 */
export function parseOperator(spec) {
  const ctx = this;
  if (isOperator(spec.type) || !spec.type) {
    ctx.operator(
      spec,
      spec.update ? ctx.operatorExpression(spec.update) : null
    );
  } else {
    ctx.transform(spec, spec.type);
  }
}

/**
 * Parse and assign operator parameters.
 */
export function parseOperatorParameters(spec) {
  const ctx = this;
  if (spec.params) {
    const op = ctx.get(spec.id);
    if (!op) error('Invalid operator id: ' + spec.id);
    ctx.dataflow.connect(op, op.parameters(
      ctx.parseParameters(spec.params),
      spec.react,
      spec.initonly
    ));
  }
}
