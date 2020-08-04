import {getDataRef} from './data';
import DataScope from '../../DataScope';
import {Collect, Facet, PreFacet, Sieve} from '../../transforms';
import {ref} from '../../util';
import {error, stringValue} from 'vega-util';

export default function(spec, scope, group) {
  var facet = spec.from.facet,
      name = facet.name,
      data = getDataRef(facet, scope),
      subscope, source, values, op;

  if (!facet.name) {
    error('Facet must have a name: ' + stringValue(facet));
  }
  if (!facet.data) {
    error('Facet must reference a data set: ' + stringValue(facet));
  }

  if (facet.field) {
    op = scope.add(PreFacet({
      field: scope.fieldRef(facet.field),
      pulse: data
    }));
  } else if (facet.groupby) {
    op = scope.add(Facet({
      key:   scope.keyRef(facet.groupby),
      group: ref(scope.proxy(group.parent)),
      pulse: data
    }));
  } else {
    error('Facet must specify groupby or field: ' + stringValue(facet));
  }

  // initialize facet subscope
  subscope = scope.fork();
  source = subscope.add(Collect());
  values = subscope.add(Sieve({pulse: ref(source)}));
  subscope.addData(name, new DataScope(subscope, source, source, values));
  subscope.addSignal('parent', null);

  // parse faceted subflow
  op.params.subflow = {
    $subflow: subscope.parse(spec).toRuntime()
  };
}
