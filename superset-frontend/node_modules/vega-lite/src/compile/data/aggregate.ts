import {AggregateOp} from 'vega';
import {isArgmaxDef, isArgminDef} from '../../aggregate';
import {
  Channel,
  getPositionChannelFromLatLong,
  getSecondaryRangeChannel,
  isGeoPositionChannel,
  isScaleChannel
} from '../../channel';
import {binRequiresRange, FieldDef, hasBand, isTypedFieldDef, vgField} from '../../channeldef';
import * as log from '../../log';
import {AggregateTransform} from '../../transform';
import {Dict, duplicate, hash, keys, replacePathInField, setEqual} from '../../util';
import {isUnitModel, ModelWithField} from '../model';
import {UnitModel} from '../unit';
import {DataFlowNode} from './dataflow';
import {AggregateTransform as VgAggregateTransform} from 'vega';

type Measures = Dict<{[key in AggregateOp]?: Set<string>}>;

function addDimension(dims: Set<string>, channel: Channel, fieldDef: FieldDef<string>, model: ModelWithField) {
  const channelDef2 = isUnitModel(model) ? model.encoding[getSecondaryRangeChannel(channel)] : undefined;

  if (
    isTypedFieldDef(fieldDef) &&
    isUnitModel(model) &&
    hasBand(channel, fieldDef, channelDef2, model.markDef, model.config)
  ) {
    dims.add(vgField(fieldDef, {}));
    dims.add(vgField(fieldDef, {suffix: 'end'}));

    if (binRequiresRange(fieldDef, channel)) {
      dims.add(vgField(fieldDef, {binSuffix: 'range'}));
    }
  } else if (isGeoPositionChannel(channel)) {
    const posChannel = getPositionChannelFromLatLong(channel);
    dims.add(model.getName(posChannel));
  } else {
    dims.add(vgField(fieldDef));
  }
  return dims;
}

function mergeMeasures(parentMeasures: Measures, childMeasures: Measures) {
  for (const field of keys(childMeasures)) {
    // when we merge a measure, we either have to add an aggregation operator or even a new field
    const ops = childMeasures[field];
    for (const op of keys(ops)) {
      if (field in parentMeasures) {
        // add operator to existing measure field
        parentMeasures[field][op] = new Set([...(parentMeasures[field][op] ?? []), ...ops[op]]);
      } else {
        parentMeasures[field] = {[op]: ops[op]};
      }
    }
  }
}

export class AggregateNode extends DataFlowNode {
  public clone() {
    return new AggregateNode(null, new Set(this.dimensions), duplicate(this.measures));
  }

  /**
   * @param dimensions string set for dimensions
   * @param measures dictionary mapping field name => dict of aggregation functions and names to use
   */
  constructor(parent: DataFlowNode, private dimensions: Set<string>, private measures: Measures) {
    super(parent);
  }

  get groupBy() {
    return this.dimensions;
  }

  public static makeFromEncoding(parent: DataFlowNode, model: UnitModel): AggregateNode {
    let isAggregate = false;
    model.forEachFieldDef(fd => {
      if (fd.aggregate) {
        isAggregate = true;
      }
    });

    const meas: Measures = {};
    const dims = new Set<string>();

    if (!isAggregate) {
      // no need to create this node if the model has no aggregation
      return null;
    }

    model.forEachFieldDef((fieldDef, channel) => {
      const {aggregate, field} = fieldDef;
      if (aggregate) {
        if (aggregate === 'count') {
          meas['*'] = meas['*'] ?? {};
          meas['*']['count'] = new Set([vgField(fieldDef, {forAs: true})]);
        } else {
          if (isArgminDef(aggregate) || isArgmaxDef(aggregate)) {
            const op = isArgminDef(aggregate) ? 'argmin' : 'argmax';
            const argField = aggregate[op];
            meas[argField] = meas[argField] ?? {};
            meas[argField][op] = new Set([vgField({op, field: argField}, {forAs: true})]);
          } else {
            meas[field] = meas[field] ?? {};
            meas[field][aggregate] = new Set([vgField(fieldDef, {forAs: true})]);
          }

          // For scale channel with domain === 'unaggregated', add min/max so we can use their union as unaggregated domain
          if (isScaleChannel(channel) && model.scaleDomain(channel) === 'unaggregated') {
            meas[field] = meas[field] ?? {};
            meas[field]['min'] = new Set([vgField({field, aggregate: 'min'}, {forAs: true})]);
            meas[field]['max'] = new Set([vgField({field, aggregate: 'max'}, {forAs: true})]);
          }
        }
      } else {
        addDimension(dims, channel, fieldDef, model);
      }
    });

    if (dims.size + keys(meas).length === 0) {
      return null;
    }

    return new AggregateNode(parent, dims, meas);
  }

  public static makeFromTransform(parent: DataFlowNode, t: AggregateTransform): AggregateNode {
    const dims = new Set<string>();
    const meas: Measures = {};

    for (const s of t.aggregate) {
      const {op, field, as} = s;
      if (op) {
        if (op === 'count') {
          meas['*'] = meas['*'] ?? {};
          meas['*']['count'] = new Set([as ? as : vgField(s, {forAs: true})]);
        } else {
          meas[field] = meas[field] ?? {};
          meas[field][op] = new Set([as ? as : vgField(s, {forAs: true})]);
        }
      }
    }

    for (const s of t.groupby ?? []) {
      dims.add(s);
    }

    if (dims.size + keys(meas).length === 0) {
      return null;
    }

    return new AggregateNode(parent, dims, meas);
  }

  public merge(other: AggregateNode): boolean {
    if (setEqual(this.dimensions, other.dimensions)) {
      mergeMeasures(this.measures, other.measures);
      return true;
    } else {
      log.debug('different dimensions, cannot merge');
      return false;
    }
  }

  public addDimensions(fields: readonly string[]) {
    fields.forEach(this.dimensions.add, this.dimensions);
  }

  public dependentFields() {
    return new Set([...this.dimensions, ...keys(this.measures)]);
  }

  public producedFields() {
    const out = new Set<string>();

    for (const field of keys(this.measures)) {
      for (const op of keys(this.measures[field])) {
        const m = this.measures[field][op];
        if (m.size === 0) {
          out.add(`${op}_${field}`);
        } else {
          m.forEach(out.add, out);
        }
      }
    }

    return out;
  }

  public hash() {
    return `Aggregate ${hash({dimensions: this.dimensions, measures: this.measures})}`;
  }

  public assemble(): VgAggregateTransform {
    const ops: AggregateOp[] = [];
    const fields: string[] = [];
    const as: string[] = [];

    for (const field of keys(this.measures)) {
      for (const op of keys(this.measures[field])) {
        for (const alias of this.measures[field][op]) {
          as.push(alias);
          ops.push(op);
          fields.push(field === '*' ? null : replacePathInField(field));
        }
      }
    }

    const result: VgAggregateTransform = {
      type: 'aggregate',
      groupby: [...this.dimensions],
      ops,
      fields,
      as
    };

    return result;
  }
}
