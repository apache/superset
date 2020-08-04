import parseTransform from '../transform';
import {Collect} from '../../transforms';
import {ref} from '../../util';
import {array, error, extend} from 'vega-util';

export default function(from, group, scope) {
  var facet, key, op, dataRef, parent;

  // if no source data, generate singleton datum
  if (!from) {
    dataRef = ref(scope.add(Collect(null, [{}])));
  }

  // if faceted, process facet specification
  else if (facet = from.facet) {
    if (!group) error('Only group marks can be faceted.');

    // use pre-faceted source data, if available
    if (facet.field != null) {
      dataRef = parent = getDataRef(facet, scope);
    } else {
      // generate facet aggregates if no direct data specification
      if (!from.data) {
        op = parseTransform(extend({
          type:    'aggregate',
          groupby: array(facet.groupby)
        }, facet.aggregate), scope);
        op.params.key = scope.keyRef(facet.groupby);
        op.params.pulse = getDataRef(facet, scope);
        dataRef = parent = ref(scope.add(op));
      } else {
        parent = ref(scope.getData(from.data).aggregate);
      }

      key = scope.keyRef(facet.groupby, true);
    }
  }

  // if not yet defined, get source data reference
  if (!dataRef) {
    dataRef = getDataRef(from, scope);
  }

  return {
    key: key,
    pulse: dataRef,
    parent: parent
  };
}

export function getDataRef(from, scope) {
  return from.$ref ? from
    : from.data && from.data.$ref ? from.data
    : ref(scope.getData(from.data).output);
}