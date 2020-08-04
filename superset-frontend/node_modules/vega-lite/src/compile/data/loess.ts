import {LoessTransform as VgLoessTransform} from 'vega';
import {LoessTransform} from '../../transform';
import {duplicate, hash} from '../../util';
import {DataFlowNode} from './dataflow';

/**
 * A class for loess transform nodes
 */
export class LoessTransformNode extends DataFlowNode {
  public clone() {
    return new LoessTransformNode(null, duplicate(this.transform));
  }

  constructor(parent: DataFlowNode, private transform: LoessTransform) {
    super(parent);
    this.transform = duplicate(transform); // duplicate to prevent side effects
    const specifiedAs = this.transform.as ?? [undefined, undefined];
    this.transform.as = [specifiedAs[0] ?? transform.on, specifiedAs[1] ?? transform.loess];
  }

  public dependentFields() {
    return new Set([this.transform.loess, this.transform.on, ...(this.transform.groupby ?? [])]);
  }

  public producedFields() {
    return new Set(this.transform.as);
  }

  public hash() {
    return `LoessTransform ${hash(this.transform)}`;
  }

  public assemble(): VgLoessTransform {
    const {loess, on, ...rest} = this.transform;
    const result: VgLoessTransform = {
      type: 'loess',
      x: on,
      y: loess,
      ...rest
    };
    return result;
  }
}
