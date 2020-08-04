import {FilterTransform as VgFilterTransform} from 'vega';
import {LogicalComposition} from '../../logical';
import {Predicate} from '../../predicate';
import {duplicate} from '../../util';
import {Model} from '../model';
import {expression} from '../predicate';
import {DataFlowNode} from './dataflow';
import {getDependentFields} from './expressions';

export class FilterNode extends DataFlowNode {
  private expr: string;
  private _dependentFields: Set<string>;
  public clone() {
    return new FilterNode(null, this.model, duplicate(this.filter));
  }

  constructor(
    parent: DataFlowNode,
    private readonly model: Model,
    private readonly filter: LogicalComposition<Predicate>
  ) {
    super(parent);

    // TODO: refactor this to not take a node and
    // then add a static function makeFromOperand and make the constructor take only an expression
    this.expr = expression(this.model, this.filter, this);

    this._dependentFields = getDependentFields(this.expr);
  }

  public dependentFields() {
    return this._dependentFields;
  }

  public producedFields() {
    return new Set<string>(); // filter does not produce any new fields
  }

  public assemble(): VgFilterTransform {
    return {
      type: 'filter',
      expr: this.expr
    };
  }

  public hash() {
    return `Filter ${this.expr}`;
  }
}
