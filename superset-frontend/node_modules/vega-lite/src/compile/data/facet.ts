import {AggregateOp} from 'vega';
import {isArray} from 'vega-util';
import {isBinning} from '../../bin';
import {COLUMN, FACET_CHANNELS, ROW} from '../../channel';
import {vgField} from '../../channeldef';
import * as log from '../../log';
import {hasDiscreteDomain} from '../../scale';
import {DEFAULT_SORT_OP, EncodingSortField, isSortField} from '../../sort';
import {hash} from '../../util';
import {isVgRangeStep, VgData} from '../../vega.schema';
import {FacetModel} from '../facet';
import {HEADER_CHANNELS, HEADER_TYPES} from '../header/component';
import {Model} from '../model';
import {assembleDomain, getFieldFromDomain} from '../scale/domain';
import {sortArrayIndexField} from './calculate';
import {DataFlowNode} from './dataflow';

interface ChildIndependentFieldsWithStep {
  x?: string;
  y?: string;
}

interface FacetChannelInfo {
  name: string;
  fields: string[];
  sortField?: EncodingSortField<string>;

  sortIndexField?: string;
}

/**
 * A node that helps us track what fields we are faceting by.
 */
export class FacetNode extends DataFlowNode {
  private readonly column: FacetChannelInfo;

  private readonly row: FacetChannelInfo;

  private readonly facet: FacetChannelInfo;

  private readonly childModel: Model;

  /**
   * @param model The facet model.
   * @param name The name that this facet source will have.
   * @param data The source data for this facet data.
   */
  public constructor(
    parent: DataFlowNode,
    public readonly model: FacetModel,
    public readonly name: string,
    public data: string
  ) {
    super(parent);

    for (const channel of FACET_CHANNELS) {
      const fieldDef = model.facet[channel];
      if (fieldDef) {
        const {bin, sort} = fieldDef;
        this[channel] = {
          name: model.getName(`${channel}_domain`),
          fields: [vgField(fieldDef), ...(isBinning(bin) ? [vgField(fieldDef, {binSuffix: 'end'})] : [])],
          ...(isSortField(sort)
            ? {sortField: sort}
            : isArray(sort)
            ? {sortIndexField: sortArrayIndexField(fieldDef, channel)}
            : {})
        };
      }
    }
    this.childModel = model.child;
  }

  public hash() {
    let out = `Facet`;

    for (const channel of FACET_CHANNELS) {
      if (this[channel]) {
        out += ` ${channel.charAt(0)}:${hash(this[channel])}`;
      }
    }

    return out;
  }

  get fields() {
    const f: string[] = [];

    for (const channel of FACET_CHANNELS) {
      if (this[channel]?.fields) {
        f.push(...this[channel].fields);
      }
    }
    return f;
  }

  public dependentFields() {
    const depFields = new Set<string>(this.fields);

    for (const channel of FACET_CHANNELS) {
      if (this[channel]) {
        if (this[channel].sortField) {
          depFields.add(this[channel].sortField.field);
        }
        if (this[channel].sortIndexField) {
          depFields.add(this[channel].sortIndexField);
        }
      }
    }

    return depFields;
  }

  public producedFields() {
    return new Set<string>(); // facet does not produce any new fields
  }

  /**
   * The name to reference this source is its name.
   */
  public getSource() {
    return this.name;
  }

  private getChildIndependentFieldsWithStep() {
    const childIndependentFieldsWithStep: ChildIndependentFieldsWithStep = {};

    for (const channel of ['x', 'y'] as const) {
      const childScaleComponent = this.childModel.component.scales[channel];
      if (childScaleComponent && !childScaleComponent.merged) {
        // independent scale
        const type = childScaleComponent.get('type');
        const range = childScaleComponent.get('range');

        if (hasDiscreteDomain(type) && isVgRangeStep(range)) {
          const domain = assembleDomain(this.childModel, channel);
          const field = getFieldFromDomain(domain);
          if (field) {
            childIndependentFieldsWithStep[channel] = field;
          } else {
            log.warn(`Unknown field for ${channel}. Cannot calculate view size.`);
          }
        }
      }
    }

    return childIndependentFieldsWithStep;
  }

  private assembleRowColumnHeaderData(
    channel: 'row' | 'column' | 'facet',
    crossedDataName: string,
    childIndependentFieldsWithStep: ChildIndependentFieldsWithStep
  ): VgData {
    const childChannel = {row: 'y', column: 'x'}[channel];

    const fields: string[] = [];
    const ops: AggregateOp[] = [];
    const as: string[] = [];

    if (childIndependentFieldsWithStep && childIndependentFieldsWithStep[childChannel]) {
      if (crossedDataName) {
        // If there is a crossed data, calculate max
        fields.push(`distinct_${childIndependentFieldsWithStep[childChannel]}`);

        ops.push('max');
      } else {
        // If there is no crossed data, just calculate distinct
        fields.push(childIndependentFieldsWithStep[childChannel]);
        ops.push('distinct');
      }
      // Although it is technically a max, just name it distinct so it's easier to refer to it
      as.push(`distinct_${childIndependentFieldsWithStep[childChannel]}`);
    }

    const {sortField, sortIndexField} = this[channel];
    if (sortField) {
      const {op = DEFAULT_SORT_OP, field} = sortField;
      fields.push(field);
      ops.push(op);
      as.push(vgField(sortField, {forAs: true}));
    } else if (sortIndexField) {
      fields.push(sortIndexField);
      ops.push('max');
      as.push(sortIndexField);
    }

    return {
      name: this[channel].name,
      // Use data from the crossed one if it exist
      source: crossedDataName ?? this.data,
      transform: [
        {
          type: 'aggregate',
          groupby: this[channel].fields,
          ...(fields.length
            ? {
                fields,
                ops,
                as
              }
            : {})
        }
      ]
    };
  }

  private assembleFacetHeaderData(childIndependentFieldsWithStep: ChildIndependentFieldsWithStep) {
    const {columns} = this.model.layout;
    const {layoutHeaders} = this.model.component;
    const data: VgData[] = [];

    const hasSharedAxis: {row?: true; column?: true} = {};
    for (const headerChannel of HEADER_CHANNELS) {
      for (const headerType of HEADER_TYPES) {
        const headers = (layoutHeaders[headerChannel] && layoutHeaders[headerChannel][headerType]) ?? [];
        for (const header of headers) {
          if (header.axes?.length > 0) {
            hasSharedAxis[headerChannel] = true;
            break;
          }
        }
      }

      if (hasSharedAxis[headerChannel]) {
        const cardinality = `length(data("${this.facet.name}"))`;

        const stop =
          headerChannel === 'row'
            ? columns
              ? {signal: `ceil(${cardinality} / ${columns})`}
              : 1
            : columns
            ? {signal: `min(${cardinality}, ${columns})`}
            : {signal: cardinality};

        data.push({
          name: `${this.facet.name}_${headerChannel}`,
          transform: [
            {
              type: 'sequence',
              start: 0,
              stop
            }
          ]
        });
      }
    }

    const {row, column} = hasSharedAxis;

    if (row || column) {
      data.unshift(this.assembleRowColumnHeaderData('facet', null, childIndependentFieldsWithStep));
    }

    return data;
  }

  public assemble() {
    const data: VgData[] = [];
    let crossedDataName = null;
    const childIndependentFieldsWithStep = this.getChildIndependentFieldsWithStep();

    const {column, row, facet} = this;

    if (column && row && (childIndependentFieldsWithStep.x || childIndependentFieldsWithStep.y)) {
      // Need to create a cross dataset to correctly calculate cardinality
      crossedDataName = `cross_${this.column.name}_${this.row.name}`;

      const fields: string[] = [].concat(
        childIndependentFieldsWithStep.x ?? [],
        childIndependentFieldsWithStep.y ?? []
      );
      const ops = fields.map((): AggregateOp => 'distinct');

      data.push({
        name: crossedDataName,
        source: this.data,
        transform: [
          {
            type: 'aggregate',
            groupby: this.fields,
            fields,
            ops
          }
        ]
      });
    }

    for (const channel of [COLUMN, ROW]) {
      if (this[channel]) {
        data.push(this.assembleRowColumnHeaderData(channel, crossedDataName, childIndependentFieldsWithStep));
      }
    }

    if (facet) {
      const facetData = this.assembleFacetHeaderData(childIndependentFieldsWithStep);
      if (facetData) {
        data.push(...facetData);
      }
    }

    return data;
  }
}
