import {isScaleChannel} from '../../channel';
import {vgField as fieldRef} from '../../channeldef';
import {isPathMark} from '../../mark';
import {hasContinuousDomain} from '../../scale';
import {Dict, hash, keys} from '../../util';
import {FilterTransform as VgFilterTransform} from 'vega';
import {getMarkPropOrConfig} from '../common';
import {UnitModel} from '../unit';
import {TypedFieldDef} from './../../channeldef';
import {DataFlowNode} from './dataflow';

export class FilterInvalidNode extends DataFlowNode {
  public clone() {
    return new FilterInvalidNode(null, {...this.filter});
  }

  constructor(parent: DataFlowNode, public readonly filter: Dict<TypedFieldDef<string>>) {
    super(parent);
  }

  public static make(parent: DataFlowNode, model: UnitModel): FilterInvalidNode {
    const {config, mark, markDef} = model;

    const invalid = getMarkPropOrConfig('invalid', markDef, config);
    if (invalid !== 'filter') {
      return null;
    }

    const filter = model.reduceFieldDef((aggregator: Dict<TypedFieldDef<string>>, fieldDef, channel) => {
      const scaleComponent = isScaleChannel(channel) && model.getScaleComponent(channel);
      if (scaleComponent) {
        const scaleType = scaleComponent.get('type');

        // While discrete domain scales can handle invalid values, continuous scales can't.
        // Thus, for non-path marks, we have to filter null for scales with continuous domains.
        // (For path marks, we will use "defined" property and skip these values instead.)
        if (hasContinuousDomain(scaleType) && !fieldDef.aggregate && !isPathMark(mark)) {
          aggregator[fieldDef.field] = fieldDef as any; // we know that the fieldDef is a typed field def
        }
      }
      return aggregator;
    }, {} as Dict<TypedFieldDef<string>>);

    if (!keys(filter).length) {
      return null;
    }

    return new FilterInvalidNode(parent, filter);
  }

  public dependentFields() {
    return new Set(keys(this.filter));
  }

  public producedFields() {
    return new Set<string>(); // filter does not produce any new fields
  }

  public hash() {
    return `FilterInvalid ${hash(this.filter)}`;
  }

  /**
   * Create the VgTransforms for each of the filtered fields.
   */
  public assemble(): VgFilterTransform {
    const filters = keys(this.filter).reduce((vegaFilters, field) => {
      const fieldDef = this.filter[field];
      const ref = fieldRef(fieldDef, {expr: 'datum'});

      if (fieldDef !== null) {
        if (fieldDef.type === 'temporal') {
          vegaFilters.push(`(isDate(${ref}) || (isValid(${ref}) && isFinite(+${ref})))`);
        } else if (fieldDef.type === 'quantitative') {
          vegaFilters.push(`isValid(${ref})`);
          vegaFilters.push(`isFinite(+${ref})`);
        } else {
          // should never get here
        }
      }
      return vegaFilters;
    }, [] as string[]);

    return filters.length > 0
      ? {
          type: 'filter',
          expr: filters.join(' && ')
        }
      : null;
  }
}
