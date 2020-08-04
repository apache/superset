import Facet from './Facet';
import {ingest, tupleid} from 'vega-dataflow';
import {accessorFields, error, inherits} from 'vega-util';

/**
 * Partitions pre-faceted data into tuple subflows.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(Dataflow, string): Operator} params.subflow - A function
 *   that generates a subflow of operators and returns its root operator.
 * @param {function(object): Array<object>} params.field - The field
 *   accessor for an array of subflow tuple objects.
 */
export default function PreFacet(params) {
  Facet.call(this, params);
}

const prototype = inherits(PreFacet, Facet);

prototype.transform = function(_, pulse) {
  const flow = _.subflow,
        field = _.field,
        subflow = t => this.subflow(tupleid(t), flow, pulse, t);

  if (_.modified('field') || field && pulse.modified(accessorFields(field))) {
    error('PreFacet does not support field modification.');
  }

  this.initTargets(); // reset list of active subflows

  if (field) {
    pulse.visit(pulse.MOD, t => {
      const sf = subflow(t);
      field(t).forEach(_ => sf.mod(_));
    });

    pulse.visit(pulse.ADD, t => {
      const sf = subflow(t);
      field(t).forEach(_ => sf.add(ingest(_)));
    });

    pulse.visit(pulse.REM, t => {
      const sf = subflow(t);
      field(t).forEach(_ => sf.rem(_));
    });
  } else {
    pulse.visit(pulse.MOD, t => subflow(t).mod(t));
    pulse.visit(pulse.ADD, t => subflow(t).add(t));
    pulse.visit(pulse.REM, t => subflow(t).rem(t));
  }

  if (pulse.clean()) {
    pulse.runAfter(() => this.clean());
  }

  return pulse;
};
