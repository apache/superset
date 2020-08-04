import {RegressionTransform as VgRegressionTransform} from 'vega';
import {RegressionTransform} from '../../transform';
import {duplicate, hash} from '../../util';
import {DataFlowNode} from './dataflow';

/**
 * A class for regression transform nodes
 */
export class RegressionTransformNode extends DataFlowNode {
  public clone() {
    return new RegressionTransformNode(null, duplicate(this.transform));
  }

  constructor(parent: DataFlowNode, private transform: RegressionTransform) {
    super(parent);
    this.transform = duplicate(transform); // duplicate to prevent side effects
    const specifiedAs = this.transform.as ?? [undefined, undefined];
    this.transform.as = [specifiedAs[0] ?? transform.on, specifiedAs[1] ?? transform.regression];
  }

  public dependentFields() {
    return new Set([this.transform.regression, this.transform.on, ...(this.transform.groupby ?? [])]);
  }

  public producedFields() {
    return new Set(this.transform.as);
  }

  public hash() {
    return `RegressionTransform ${hash(this.transform)}`;
  }

  public assemble(): VgRegressionTransform {
    const {regression, on, ...rest} = this.transform;
    const result: VgRegressionTransform = {
      type: 'regression',
      x: on,
      y: regression,
      ...rest
    };
    return result;
  }
}
