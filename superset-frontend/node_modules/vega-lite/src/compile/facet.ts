import {AggregateOp, LayoutAlign, NewSignal} from 'vega';
import {isArray} from 'vega-util';
import {isBinning} from '../bin';
import {Channel, COLUMN, FacetChannel, FACET_CHANNELS, ROW, ScaleChannel} from '../channel';
import {FieldRefOption, normalize, TypedFieldDef, vgField} from '../channeldef';
import {Config} from '../config';
import {reduce} from '../encoding';
import * as log from '../log';
import {hasDiscreteDomain} from '../scale';
import {DEFAULT_SORT_OP, EncodingSortField, isSortField, SortOrder} from '../sort';
import {NormalizedFacetSpec} from '../spec';
import {EncodingFacetMapping, FacetFieldDef, FacetMapping, isFacetMapping} from '../spec/facet';
import {contains} from '../util';
import {isVgRangeStep, VgData, VgLayout, VgMarkGroup} from '../vega.schema';
import {buildModel} from './buildmodel';
import {assembleFacetData} from './data/assemble';
import {sortArrayIndexField} from './data/calculate';
import {parseData} from './data/parse';
import {assembleLabelTitle} from './header/assemble';
import {getHeaderChannel, getHeaderProperty} from './header/common';
import {HEADER_CHANNELS, HEADER_TYPES} from './header/component';
import {parseFacetHeaders} from './header/parse';
import {parseChildrenLayoutSize} from './layoutsize/parse';
import {Model, ModelWithField} from './model';
import {RepeaterValue, replaceRepeaterInFacet} from './repeater';
import {assembleDomain, getFieldFromDomain} from './scale/domain';
import {assembleFacetSignals} from './selection/assemble';

export function facetSortFieldName(
  fieldDef: FacetFieldDef<string>,
  sort: EncodingSortField<string>,
  opt?: FieldRefOption
) {
  return vgField(sort, {suffix: `by_${vgField(fieldDef)}`, ...(opt ?? {})});
}

export class FacetModel extends ModelWithField {
  public readonly facet: EncodingFacetMapping<string>;

  public readonly child: Model;

  public readonly children: Model[];

  constructor(
    spec: NormalizedFacetSpec,
    parent: Model,
    parentGivenName: string,
    repeater: RepeaterValue,
    config: Config
  ) {
    super(spec, 'facet', parent, parentGivenName, config, repeater, spec.resolve);

    this.child = buildModel(spec.spec, this, this.getName('child'), undefined, repeater, config);
    this.children = [this.child];

    const facet = replaceRepeaterInFacet(spec.facet, repeater);

    this.facet = this.initFacet(facet);
  }

  private initFacet(facet: FacetFieldDef<string> | FacetMapping<string>): EncodingFacetMapping<string> {
    // clone to prevent side effect to the original spec
    if (!isFacetMapping(facet)) {
      return {facet: normalize(facet, 'facet')};
    }

    return reduce(
      facet,
      (normalizedFacet, fieldDef: TypedFieldDef<string>, channel: Channel) => {
        if (!contains([ROW, COLUMN], channel)) {
          // Drop unsupported channel
          log.warn(log.message.incompatibleChannel(channel, 'facet'));
          return normalizedFacet;
        }

        if (fieldDef.field === undefined) {
          log.warn(log.message.emptyFieldDef(fieldDef, channel));
          return normalizedFacet;
        }

        // Convert type to full, lowercase type, or augment the fieldDef with a default type if missing.
        normalizedFacet[channel] = normalize(fieldDef, channel);
        return normalizedFacet;
      },
      {}
    );
  }

  public channelHasField(channel: Channel): boolean {
    return !!this.facet[channel];
  }

  public fieldDef(channel: Channel): TypedFieldDef<string> {
    return this.facet[channel];
  }

  public parseData() {
    this.component.data = parseData(this);
    this.child.parseData();
  }

  public parseLayoutSize() {
    parseChildrenLayoutSize(this);
  }

  public parseSelections() {
    // As a facet has a single child, the selection components are the same.
    // The child maintains its selections to assemble signals, which remain
    // within its unit.
    this.child.parseSelections();
    this.component.selection = this.child.component.selection;
  }

  public parseMarkGroup() {
    this.child.parseMarkGroup();
  }

  public parseAxesAndHeaders() {
    this.child.parseAxesAndHeaders();

    parseFacetHeaders(this);
  }

  public assembleSelectionTopLevelSignals(signals: NewSignal[]): NewSignal[] {
    return this.child.assembleSelectionTopLevelSignals(signals);
  }

  public assembleSignals(): NewSignal[] {
    this.child.assembleSignals();
    return [];
  }

  public assembleSelectionData(data: readonly VgData[]): readonly VgData[] {
    return this.child.assembleSelectionData(data);
  }

  private getHeaderLayoutMixins(): VgLayout {
    const layoutMixins: VgLayout = {};

    for (const channel of FACET_CHANNELS) {
      for (const headerType of HEADER_TYPES) {
        const layoutHeaderComponent = this.component.layoutHeaders[channel];
        const headerComponent = layoutHeaderComponent[headerType];

        const {facetFieldDef} = layoutHeaderComponent;
        if (facetFieldDef) {
          const titleOrient = getHeaderProperty('titleOrient', facetFieldDef, this.config, channel);

          if (contains(['right', 'bottom'], titleOrient)) {
            const headerChannel = getHeaderChannel(channel, titleOrient);
            layoutMixins.titleAnchor = layoutMixins.titleAnchor ?? {};
            layoutMixins.titleAnchor[headerChannel] = 'end';
          }
        }

        if (headerComponent?.[0]) {
          // set header/footerBand
          const sizeType = channel === 'row' ? 'height' : 'width';
          const bandType = headerType === 'header' ? 'headerBand' : 'footerBand';
          if (channel !== 'facet' && !this.child.component.layoutSize.get(sizeType)) {
            // If facet child does not have size signal, then apply headerBand
            layoutMixins[bandType] = layoutMixins[bandType] ?? {};
            layoutMixins[bandType][channel] = 0.5;
          }

          if (layoutHeaderComponent.title) {
            layoutMixins.offset = layoutMixins.offset ?? {};
            layoutMixins.offset[channel === 'row' ? 'rowTitle' : 'columnTitle'] = 10;
          }
        }
      }
    }
    return layoutMixins;
  }

  protected assembleDefaultLayout(): VgLayout {
    const {column, row} = this.facet;

    const columns = column ? this.columnDistinctSignal() : row ? 1 : undefined;

    let align: LayoutAlign = 'all';

    // Do not align the cells if the scale corresponding to the direction is indepent.
    // We always align when we facet into both row and column.
    if (!row && this.component.resolve.scale.x === 'independent') {
      align = 'none';
    } else if (!column && this.component.resolve.scale.y === 'independent') {
      align = 'none';
    }

    return {
      ...this.getHeaderLayoutMixins(),

      ...(columns ? {columns} : {}),
      bounds: 'full',
      align
    };
  }

  public assembleLayoutSignals(): NewSignal[] {
    // FIXME(https://github.com/vega/vega-lite/issues/1193): this can be incorrect if we have independent scales.
    return this.child.assembleLayoutSignals();
  }

  private columnDistinctSignal() {
    if (this.parent && this.parent instanceof FacetModel) {
      // For nested facet, we will add columns to group mark instead
      // See discussion in https://github.com/vega/vega/issues/952
      // and https://github.com/vega/vega-view/releases/tag/v1.2.6
      return undefined;
    } else {
      // In facetNode.assemble(), the name is always this.getName('column') + '_layout'.
      const facetLayoutDataName = this.getName('column_domain');
      return {signal: `length(data('${facetLayoutDataName}'))`};
    }
  }

  public assembleGroup(signals: NewSignal[]) {
    if (this.parent && this.parent instanceof FacetModel) {
      // Provide number of columns for layout.
      // See discussion in https://github.com/vega/vega/issues/952
      // and https://github.com/vega/vega-view/releases/tag/v1.2.6
      return {
        ...(this.channelHasField('column')
          ? {
              encode: {
                update: {
                  // TODO(https://github.com/vega/vega-lite/issues/2759):
                  // Correct the signal for facet of concat of facet_column
                  columns: {field: vgField(this.facet.column, {prefix: 'distinct'})}
                }
              }
            }
          : {}),
        ...super.assembleGroup(signals)
      };
    }
    return super.assembleGroup(signals);
  }

  /**
   * Aggregate cardinality for calculating size
   */
  private getCardinalityAggregateForChild() {
    const fields: string[] = [];
    const ops: AggregateOp[] = [];
    const as: string[] = [];

    if (this.child instanceof FacetModel) {
      if (this.child.channelHasField('column')) {
        const field = vgField(this.child.facet.column);
        fields.push(field);
        ops.push('distinct');
        as.push(`distinct_${field}`);
      }
    } else {
      for (const channel of ['x', 'y'] as ScaleChannel[]) {
        const childScaleComponent = this.child.component.scales[channel];
        if (childScaleComponent && !childScaleComponent.merged) {
          const type = childScaleComponent.get('type');
          const range = childScaleComponent.get('range');

          if (hasDiscreteDomain(type) && isVgRangeStep(range)) {
            const domain = assembleDomain(this.child, channel);
            const field = getFieldFromDomain(domain);
            if (field) {
              fields.push(field);
              ops.push('distinct');
              as.push(`distinct_${field}`);
            } else {
              log.warn(`Unknown field for ${channel}. Cannot calculate view size.`);
            }
          }
        }
      }
    }
    return {fields, ops, as};
  }

  private assembleFacet() {
    const {name, data} = this.component.data.facetRoot;
    const {row, column} = this.facet;
    const {fields, ops, as} = this.getCardinalityAggregateForChild();
    const groupby: string[] = [];

    for (const channel of FACET_CHANNELS) {
      const fieldDef = this.facet[channel];
      if (fieldDef) {
        groupby.push(vgField(fieldDef));

        const {bin, sort} = fieldDef;

        if (isBinning(bin)) {
          groupby.push(vgField(fieldDef, {binSuffix: 'end'}));
        }

        if (isSortField(sort)) {
          const {field, op = DEFAULT_SORT_OP} = sort;
          const outputName = facetSortFieldName(fieldDef, sort);
          if (row && column) {
            // For crossed facet, use pre-calculate field as it requires a different groupby
            // For each calculated field, apply max and assign them to the same name as
            // all values of the same group should be the same anyway.
            fields.push(outputName);
            ops.push('max');
            as.push(outputName);
          } else {
            fields.push(field);
            ops.push(op);
            as.push(outputName);
          }
        } else if (isArray(sort)) {
          const outputName = sortArrayIndexField(fieldDef, channel);
          fields.push(outputName);
          ops.push('max');
          as.push(outputName);
        }
      }
    }

    const cross = !!row && !!column;

    return {
      name,
      data,
      groupby,
      ...(cross || fields.length > 0
        ? {
            aggregate: {
              ...(cross ? {cross} : {}),
              ...(fields.length ? {fields, ops, as} : {})
            }
          }
        : {})
    };
  }

  private facetSortFields(channel: FacetChannel): string[] {
    const {facet} = this;
    const fieldDef = facet[channel];

    if (fieldDef) {
      if (isSortField(fieldDef.sort)) {
        return [facetSortFieldName(fieldDef, fieldDef.sort, {expr: 'datum'})];
      } else if (isArray(fieldDef.sort)) {
        return [sortArrayIndexField(fieldDef, channel, {expr: 'datum'})];
      }
      return [vgField(fieldDef, {expr: 'datum'})];
    }
    return [];
  }

  private facetSortOrder(channel: FacetChannel): SortOrder[] {
    const {facet} = this;
    const fieldDef = facet[channel];
    if (fieldDef) {
      const {sort} = fieldDef;
      const order = (isSortField(sort) ? sort.order : !isArray(sort) && sort) || 'ascending';
      return [order];
    }
    return [];
  }

  private assembleLabelTitle() {
    const {facet, config} = this;
    if (facet.facet) {
      // Facet always uses title to display labels
      return assembleLabelTitle(facet.facet, 'facet', config);
    }

    const ORTHOGONAL_ORIENT = {
      row: ['top', 'bottom'],
      column: ['left', 'right']
    };

    for (const channel of HEADER_CHANNELS) {
      if (facet[channel]) {
        const labelOrient = getHeaderProperty('labelOrient', facet[channel], config, channel);
        if (contains(ORTHOGONAL_ORIENT[channel], labelOrient)) {
          // Row/Column with orthogonal labelOrient must use title to display labels
          return assembleLabelTitle(facet[channel], channel, config);
        }
      }
    }
    return undefined;
  }

  public assembleMarks(): VgMarkGroup[] {
    const {child} = this;

    // If we facet by two dimensions, we need to add a cross operator to the aggregation
    // so that we create all groups
    const facetRoot = this.component.data.facetRoot;
    const data = assembleFacetData(facetRoot);

    const encodeEntry = child.assembleGroupEncodeEntry(false);

    const title = this.assembleLabelTitle() || child.assembleTitle();
    const style = child.assembleGroupStyle();

    const markGroup = {
      name: this.getName('cell'),
      type: 'group',
      ...(title ? {title} : {}),
      ...(style ? {style} : {}),
      from: {
        facet: this.assembleFacet()
      },
      // TODO: move this to after data
      sort: {
        field: FACET_CHANNELS.map(c => this.facetSortFields(c)).flat(),
        order: FACET_CHANNELS.map(c => this.facetSortOrder(c)).flat()
      },
      ...(data.length > 0 ? {data: data} : {}),
      ...(encodeEntry ? {encode: {update: encodeEntry}} : {}),
      ...child.assembleGroup(assembleFacetSignals(this, []))
    };

    return [markGroup];
  }

  protected getMapping() {
    return this.facet;
  }
}
