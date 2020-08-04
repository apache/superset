import parseUpdate from './update';
import {parseExpression} from 'vega-functions';
import {error} from 'vega-util';

export default function(signal, scope) {
  var op = scope.getSignal(signal.name),
      expr = signal.update;

  if (signal.init) {
    if (expr) {
      error('Signals can not include both init and update expressions.');
    } else {
      expr = signal.init;
      op.initonly = true;
    }
  }

  if (expr) {
    expr = parseExpression(expr, scope);
    op.update = expr.$expr;
    op.params = expr.$params;
  }

  if (signal.on) {
    signal.on.forEach(function(_) {
      parseUpdate(_, scope, op.id);
    });
  }
}
