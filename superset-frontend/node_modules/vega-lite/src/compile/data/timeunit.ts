import {TimeUnitTransform as VgTimeUnitTransform} from 'vega';
import {getSecondaryRangeChannel} from '../../channel';
import {hasBand, vgField} from '../../channeldef';
import {getTimeUnitParts, normalizeTimeUnit} from '../../timeunit';
import {TimeUnitTransform} from '../../transform';
import {Dict, duplicate, hash, keys, vals} from '../../util';
import {isUnitModel, ModelWithField} from '../model';
import {DataFlowNode} from './dataflow';

export type TimeUnitComponent = TimeUnitTransform & {
  /** whether to output time unit as a band (generate two formula including start and end) */
  band?: boolean;
};

export class TimeUnitNode extends DataFlowNode {
  public clone() {
    return new TimeUnitNode(null, duplicate(this.formula));
  }

  constructor(parent: DataFlowNode, private formula: Dict<TimeUnitComponent>) {
    super(parent);
  }

  public static makeFromEncoding(parent: DataFlowNode, model: ModelWithField) {
    const formula = model.reduceFieldDef((timeUnitComponent: TimeUnitComponent, fieldDef, channel) => {
      const {field, timeUnit} = fieldDef;

      const channelDef2 = isUnitModel(model) ? model.encoding[getSecondaryRangeChannel(channel)] : undefined;

      const band = isUnitModel(model) && hasBand(channel, fieldDef, channelDef2, model.markDef, model.config);

      if (timeUnit) {
        const as = vgField(fieldDef, {forAs: true});
        timeUnitComponent[
          hash({
            as,
            field,
            timeUnit
          })
        ] = {
          as,
          field,
          timeUnit,
          ...(band ? {band: true} : {})
        };
      }
      return timeUnitComponent;
    }, {} as Dict<TimeUnitComponent>);

    if (keys(formula).length === 0) {
      return null;
    }

    return new TimeUnitNode(parent, formula);
  }

  public static makeFromTransform(parent: DataFlowNode, t: TimeUnitTransform) {
    const {timeUnit, ...other} = {...t};

    const normalizedTimeUnit = normalizeTimeUnit(timeUnit);

    const component = {
      ...other,
      timeUnit: normalizedTimeUnit
    };

    return new TimeUnitNode(parent, {
      [hash(component)]: component
    });
  }

  /**
   * Merge together TimeUnitNodes assigning the children of `other` to `this`
   * and removing `other`.
   */
  public merge(other: TimeUnitNode) {
    this.formula = {...this.formula};

    // if the same hash happen twice, merge "band"
    for (const key in other.formula) {
      if (!this.formula[key] || other.formula[key].band) {
        // copy if it's not a duplicate or if we need to include copy band over
        this.formula[key] = other.formula[key];
      }
    }

    for (const child of other.children) {
      other.removeChild(child);
      child.parent = this;
    }

    other.remove();
  }

  public producedFields() {
    return new Set(vals(this.formula).map(f => f.as));
  }

  public dependentFields() {
    return new Set(vals(this.formula).map(f => f.field));
  }

  public hash() {
    return `TimeUnit ${hash(this.formula)}`;
  }

  public assemble() {
    const transforms: VgTimeUnitTransform[] = [];

    for (const f of vals(this.formula)) {
      const {field, as, timeUnit} = f;
      const {unit, utc, ...params} = normalizeTimeUnit(timeUnit);

      transforms.push({
        field,
        type: 'timeunit',
        ...(unit ? {units: getTimeUnitParts(unit)} : {}),
        ...(utc ? {timezone: 'utc'} : {}),
        ...params,
        as: [as, `${as}_end`]
      });
    }

    return transforms;
  }
}
