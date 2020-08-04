import {FormulaTransform as VgFormulaTransform, SignalRef} from 'vega';
import {isFieldDef} from '../../channeldef';
import {pathGroupingFields} from '../../encoding';
import {ImputeSequence, ImputeTransform, isImputeSequence} from '../../transform';
import {duplicate, hash} from '../../util';
import {ImputeTransform as VgImputeTransform} from 'vega';
import {UnitModel} from '../unit';
import {DataFlowNode} from './dataflow';
import {WindowTransform as VgWindowTransform} from 'vega';

export class ImputeNode extends DataFlowNode {
  public clone() {
    return new ImputeNode(null, duplicate(this.transform));
  }

  constructor(parent: DataFlowNode, private readonly transform: ImputeTransform) {
    super(parent);
  }

  public dependentFields() {
    return new Set([this.transform.impute, this.transform.key, ...(this.transform.groupby ?? [])]);
  }

  public producedFields() {
    return new Set([this.transform.impute]);
  }

  private processSequence(keyvals: ImputeSequence): SignalRef {
    const {start = 0, stop, step} = keyvals;
    const result = [start, stop, ...(step ? [step] : [])].join(',');

    return {signal: `sequence(${result})`};
  }

  public static makeFromTransform(parent: DataFlowNode, imputeTransform: ImputeTransform): ImputeNode {
    return new ImputeNode(parent, imputeTransform);
  }

  public static makeFromEncoding(parent: DataFlowNode, model: UnitModel) {
    const encoding = model.encoding;
    const xDef = encoding.x;
    const yDef = encoding.y;

    if (isFieldDef(xDef) && isFieldDef(yDef)) {
      const imputedChannel = xDef.impute ? xDef : yDef.impute ? yDef : undefined;
      if (imputedChannel === undefined) {
        return undefined;
      }
      const keyChannel = xDef.impute ? yDef : yDef.impute ? xDef : undefined;
      const {method, value, frame, keyvals} = imputedChannel.impute;
      const groupbyFields = pathGroupingFields(model.mark, encoding);

      return new ImputeNode(parent, {
        impute: imputedChannel.field,
        key: keyChannel.field,
        ...(method ? {method} : {}),
        ...(value !== undefined ? {value} : {}),
        ...(frame ? {frame} : {}),
        ...(keyvals !== undefined ? {keyvals} : {}),
        ...(groupbyFields.length ? {groupby: groupbyFields} : {})
      });
    }
    return null;
  }

  public hash() {
    return `Impute ${hash(this.transform)}`;
  }

  public assemble() {
    const {impute, key, keyvals, method, groupby, value, frame = [null, null] as [null, null]} = this.transform;

    const initialImpute: VgImputeTransform = {
      type: 'impute',
      field: impute,
      key,
      ...(keyvals ? {keyvals: isImputeSequence(keyvals) ? this.processSequence(keyvals) : keyvals} : {}),
      method: 'value',
      ...(groupby ? {groupby} : {}),
      value: null
    };
    let setImputedField;
    if (method && method !== 'value') {
      const deriveNewField: VgWindowTransform = {
        type: 'window',
        as: [`imputed_${impute}_value`],
        ops: [method],
        fields: [impute],
        frame,
        ignorePeers: false,
        ...(groupby ? {groupby} : {})
      };
      const replaceOriginal: VgFormulaTransform = {
        type: 'formula',
        expr: `datum.${impute} === null ? datum.imputed_${impute}_value : datum.${impute}`,
        as: impute
      };
      setImputedField = [deriveNewField, replaceOriginal];
    } else {
      const replaceWithValue: VgFormulaTransform = {
        type: 'formula',
        expr: `datum.${impute} === null ? ${value} : datum.${impute}`,
        as: impute
      };
      setImputedField = [replaceWithValue];
    }

    return [initialImpute, ...setImputedField];
  }
}
