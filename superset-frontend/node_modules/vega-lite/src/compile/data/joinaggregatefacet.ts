import {vgField} from '../../channeldef';
import {DEFAULT_SORT_OP, isSortField} from '../../sort';
import {FacetMapping} from '../../spec/facet';
import {facetSortFieldName} from '../facet';
import {DataFlowNode} from './dataflow';
import {JoinAggregateTransformNode} from './joinaggregate';

export function makeJoinAggregateFromFacet(
  parent: DataFlowNode,
  facet: FacetMapping<string>
): JoinAggregateTransformNode {
  const {row, column} = facet;
  if (row && column) {
    let newParent = null;
    // only need to make one for crossed facet
    for (const fieldDef of [row, column]) {
      if (isSortField(fieldDef.sort)) {
        const {field, op = DEFAULT_SORT_OP} = fieldDef.sort;
        parent = newParent = new JoinAggregateTransformNode(parent, {
          joinaggregate: [
            {
              op,
              field,
              as: facetSortFieldName(fieldDef, fieldDef.sort, {forAs: true})
            }
          ],
          groupby: [vgField(fieldDef)]
        });
      }
    }
    return newParent;
  }
  return null;
}
