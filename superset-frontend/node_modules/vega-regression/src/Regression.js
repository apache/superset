import partition from './partition';
import {Transform, ingest} from 'vega-dataflow';
import {
  regressionExp, regressionLinear, regressionLog,
  regressionPoly, regressionPow, regressionQuad, sampleCurve
} from 'vega-statistics';
import {accessorName, error, extent, hasOwnProperty, inherits} from 'vega-util';

const Methods = {
  linear: regressionLinear,
  log:    regressionLog,
  exp:    regressionExp,
  pow:    regressionPow,
  quad:   regressionQuad,
  poly:   regressionPoly
};

function degreesOfFreedom(method, order) {
  return method === 'poly' ? order : method === 'quad' ? 2 : 1;
}

/**
 * Compute regression fits for one or more data groups.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.x - An accessor for the predictor data field.
 * @param {function(object): *} params.y - An accessor for the predicted data field.
 * @param {string} [params.method='linear'] - The regression method to apply.
 * @param {Array<function(object): *>} [params.groupby] - An array of accessors to groupby.
 * @param {Array<number>} [params.extent] - The domain extent over which to plot the regression line.
 * @param {number} [params.order=3] - The polynomial order. Only applies to the 'poly' method.
 */
export default function Regression(params) {
  Transform.call(this, null, params);
}

Regression.Definition = {
  'type': 'Regression',
  'metadata': {'generates': true},
  'params': [
    { 'name': 'x', 'type': 'field', 'required': true },
    { 'name': 'y', 'type': 'field', 'required': true },
    { 'name': 'groupby', 'type': 'field', 'array': true },
    { 'name': 'method', 'type': 'string', 'default': 'linear', 'values': Object.keys(Methods) },
    { 'name': 'order', 'type': 'number', 'default': 3 },
    { 'name': 'extent', 'type': 'number', 'array': true, 'length': 2 },
    { 'name': 'params', 'type': 'boolean', 'default': false },
    { 'name': 'as', 'type': 'string', 'array': true }
  ]
};

var prototype = inherits(Regression, Transform);

prototype.transform = function(_, pulse) {
  var out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS);

  if (!this.value || pulse.changed() || _.modified()) {
    const source = pulse.materialize(pulse.SOURCE).source,
          groups = partition(source, _.groupby),
          names = (_.groupby || []).map(accessorName),
          method = _.method || 'linear',
          order = _.order || 3,
          dof = degreesOfFreedom(method, order),
          as = _.as || [accessorName(_.x), accessorName(_.y)],
          fit = Methods[method],
          values = [];

    let domain = _.extent;

    if (!hasOwnProperty(Methods, method)) {
      error('Invalid regression method: ' + method);
    }

    if (domain != null) {
      if (method === 'log' && domain[0] <= 0) {
        pulse.dataflow.warn('Ignoring extent with values <= 0 for log regression.');
        domain = null;
      }
    }

    groups.forEach(g => {
      const n = g.length;
      if (n <= dof) {
        pulse.dataflow.warn('Skipping regression with more parameters than data points.');
        return;
      }

      const model = fit(g, _.x, _.y, order);

      if (_.params) {
        // if parameter vectors requested return those
        values.push(ingest({
          keys: g.dims,
          coef: model.coef,
          rSquared: model.rSquared
        }));
        return;
      }

      const dom = domain || extent(g, _.x),
            add = p => {
              const t = {};
              for (let i=0; i<names.length; ++i) {
                t[names[i]] = g.dims[i];
              }
              t[as[0]] = p[0];
              t[as[1]] = p[1];
              values.push(ingest(t));
            };

      if (method === 'linear') {
        // for linear regression we only need the end points
        dom.forEach(x => add([x, model.predict(x)]));
      } else {
        // otherwise return trend line sample points
        sampleCurve(model.predict, dom, 25, 200).forEach(add);
      }
    });

    if (this.value) out.rem = this.value;
    this.value = out.add = out.source = values;
  }

  return out;
};
