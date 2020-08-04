import {KDETransform as VgKDETransform} from 'vega';
import {DensityTransform} from '../../transform';
import {duplicate, hash} from '../../util';
import {DataFlowNode} from './dataflow';

/**
 * A class for density transform nodes
 */
export class DensityTransformNode extends DataFlowNode {
  public clone() {
    return new DensityTransformNode(null, duplicate(this.transform));
  }

  constructor(parent: DataFlowNode, private transform: DensityTransform) {
    super(parent);
    this.transform = duplicate(transform); // duplicate to prevent side effects
    const specifiedAs = this.transform.as ?? [undefined, undefined];
    this.transform.as = [specifiedAs[0] ?? 'value', specifiedAs[1] ?? 'density'];
  }

  public dependentFields() {
    return new Set([this.transform.density, ...(this.transform.groupby ?? [])]);
  }

  public producedFields() {
    return new Set(this.transform.as);
  }

  public hash() {
    return `DensityTransform ${hash(this.transform)}`;
  }

  public assemble(): VgKDETransform {
    const {density, ...rest} = this.transform;
    const result: VgKDETransform = {
      type: 'kde',
      field: density,
      ...rest
    };
    return result;
  }
}
