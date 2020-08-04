import {FoldTransform as VgFoldTransform} from 'vega';
import {FoldTransform} from '../../transform';
import {duplicate, hash} from '../../util';
import {DataFlowNode} from './dataflow';

/**
 * A class for flatten transform nodes
 */
export class FoldTransformNode extends DataFlowNode {
  public clone() {
    return new FoldTransformNode(null, duplicate(this.transform));
  }

  constructor(parent: DataFlowNode, private transform: FoldTransform) {
    super(parent);
    this.transform = duplicate(transform); // duplicate to prevent side effects
    const specifiedAs = this.transform.as ?? [undefined, undefined];
    this.transform.as = [specifiedAs[0] ?? 'key', specifiedAs[1] ?? 'value'];
  }

  public dependentFields() {
    return new Set(this.transform.fold);
  }

  public producedFields() {
    return new Set(this.transform.as);
  }

  public hash() {
    return `FoldTransform ${hash(this.transform)}`;
  }

  public assemble(): VgFoldTransform {
    const {fold, as} = this.transform;
    const result: VgFoldTransform = {
      type: 'fold',
      fields: fold,
      as
    };
    return result;
  }
}
