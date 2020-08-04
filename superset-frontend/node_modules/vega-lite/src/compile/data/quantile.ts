import {QuantileTransform as VgQuantileTransform} from 'vega';
import {QuantileTransform} from '../../transform';
import {duplicate, hash} from '../../util';
import {DataFlowNode} from './dataflow';

/**
 * A class for quantile transform nodes
 */
export class QuantileTransformNode extends DataFlowNode {
  public clone() {
    return new QuantileTransformNode(null, duplicate(this.transform));
  }

  constructor(parent: DataFlowNode, private transform: QuantileTransform) {
    super(parent);
    this.transform = duplicate(transform); // duplicate to prevent side effects
    const specifiedAs = this.transform.as ?? [undefined, undefined];
    this.transform.as = [specifiedAs[0] ?? 'prob', specifiedAs[1] ?? 'value'];
  }

  public dependentFields() {
    return new Set([this.transform.quantile, ...(this.transform.groupby ?? [])]);
  }

  public producedFields() {
    return new Set(this.transform.as);
  }

  public hash() {
    return `QuantileTransform ${hash(this.transform)}`;
  }

  public assemble(): VgQuantileTransform {
    const {quantile, ...rest} = this.transform;
    const result: VgQuantileTransform = {
      type: 'quantile',
      field: quantile,
      ...rest
    };
    return result;
  }
}
