import {SELECTION_ID} from '../../selection';
import {IdentifierTransform as VgIdentifierTransform} from 'vega';
import {DataFlowNode} from './dataflow';

export class IdentifierNode extends DataFlowNode {
  public clone() {
    return new IdentifierNode(null);
  }

  constructor(parent: DataFlowNode) {
    super(parent);
  }

  public dependentFields() {
    return new Set<string>();
  }

  public producedFields() {
    return new Set([SELECTION_ID]);
  }

  public hash() {
    return 'Identifier';
  }

  public assemble(): VgIdentifierTransform {
    return {type: 'identifier', as: SELECTION_ID};
  }
}
