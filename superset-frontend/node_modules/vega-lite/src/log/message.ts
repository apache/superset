import {AggregateOp} from 'vega';
import {Aggregate} from '../aggregate';
import {Channel, FacetChannel, GeoPositionChannel, getSizeType, PositionScaleChannel} from '../channel';
import {TypedFieldDef, Value, HiddenCompositeAggregate} from '../channeldef';
import {SplitParentProperty} from '../compile/split';
import {CompositeMark} from '../compositemark';
import {ErrorBarCenter, ErrorBarExtent} from '../compositemark/errorbar';
import {DateTime, DateTimeExpr} from '../datetime';
import {Mark} from '../mark';
import {Projection} from '../projection';
import {ScaleType} from '../scale';
import {GenericSpec} from '../spec';
import {Type} from '../type';
import {stringify, replaceAll} from '../util';
import {VgSortField} from '../vega.schema';

/**
 * Collection of all Vega-Lite Error Messages
 */

export function invalidSpec(spec: GenericSpec<any, any>) {
  return `Invalid specification ${JSON.stringify(
    spec
  )}. Make sure the specification includes at least one of the following properties: "mark", "layer", "facet", "hconcat", "vconcat", "concat", or "repeat".`;
}

// FIT
export const FIT_NON_SINGLE = 'Autosize "fit" only works for single views and layered views.';

export function containerSizeNonSingle(name: 'width' | 'height') {
  const uName = name == 'width' ? 'Width' : 'Height';
  return `${uName} "container" only works for single views and layered views.`;
}

export function containerSizeNotCompatibleWithAutosize(name: 'width' | 'height') {
  const uName = name == 'width' ? 'Width' : 'Height';
  return `${uName} "container" only works well with autosize "fit" or "fit-x".`;
}

export function droppingFit(channel?: PositionScaleChannel) {
  return channel
    ? `Dropping "fit-${channel}" because spec has discrete ${getSizeType(channel)}.`
    : `Dropping "fit" because spec has discrete size.`;
}

// SELECTION
export function cannotProjectOnChannelWithoutField(channel: Channel) {
  return `Cannot project a selection on encoding channel "${channel}", which has no field.`;
}

export function cannotProjectAggregate(channel: Channel, aggregate: Aggregate | HiddenCompositeAggregate) {
  return `Cannot project a selection on encoding channel "${channel}" as it uses an aggregate function ("${aggregate}").`;
}

export function nearestNotSupportForContinuous(mark: string) {
  return `The "nearest" transform is not supported for ${mark} marks.`;
}

export function selectionNotSupported(mark: CompositeMark) {
  return `Selection not supported for ${mark} yet.`;
}

export function selectionNotFound(name: string) {
  return `Cannot find a selection named "${name}".`;
}

export const SCALE_BINDINGS_CONTINUOUS =
  'Scale bindings are currently only supported for scales with unbinned, continuous domains.';

export const LEGEND_BINDINGS_PROJECT_LENGTH =
  'Legend bindings are only supported for selections over an individual field or encoding channel.';
export function noSameUnitLookup(name: string) {
  return (
    `Cannot define and lookup the "${name}" selection in the same view. ` +
    `Try moving the lookup into a second, layered view?`
  );
}

// REPEAT
export function noSuchRepeatedValue(field: string) {
  return `Unknown repeated value "${field}".`;
}

export function columnsNotSupportByRowCol(type: 'facet' | 'repeat') {
  return `The "columns" property cannot be used when "${type}" has nested row/column.`;
}

// CONCAT
export const CONCAT_CANNOT_SHARE_AXIS =
  'Axes cannot be shared in concatenated views yet (https://github.com/vega/vega-lite/issues/2415).';

// REPEAT
export const REPEAT_CANNOT_SHARE_AXIS =
  'Axes cannot be shared in repeated views yet (https://github.com/vega/vega-lite/issues/2415).';

// DATA
export function unrecognizedParse(p: string) {
  return `Unrecognized parse "${p}".`;
}

export function differentParse(field: string, local: string, ancestor: string) {
  return `An ancestor parsed field "${field}" as ${ancestor} but a child wants to parse the field as ${local}.`;
}

// TRANSFORMS
export function invalidTransformIgnored(transform: any) {
  return `Ignoring an invalid transform: ${stringify(transform)}.`;
}

export const NO_FIELDS_NEEDS_AS =
  'If "from.fields" is not specified, "as" has to be a string that specifies the key to be used for the data from the secondary source.';

// ENCODING & FACET

export function encodingOverridden(channels: Channel[]) {
  return `Layer's shared ${channels.join(',')} channel ${channels.length === 1 ? 'is' : 'are'} overriden.`;
}
export function projectionOverridden(opt: {parentProjection: Projection; projection: Projection}) {
  const {parentProjection, projection} = opt;
  return `Layer's shared projection ${stringify(parentProjection)} is overridden by a child projection ${stringify(
    projection
  )}.`;
}

export function primitiveChannelDef(
  channel: Channel,
  type: 'string' | 'number' | 'boolean',
  value: Exclude<Value, null>
) {
  return `Channel ${channel} is a ${type}. Converted to {value: ${stringify(value)}}.`;
}

export function invalidFieldType(type: Type) {
  return `Invalid field type "${type}".`;
}

export function nonZeroScaleUsedWithLengthMark(
  mark: 'bar' | 'area',
  channel: Channel,
  opt: {scaleType?: ScaleType; zeroFalse?: boolean}
) {
  const scaleText = opt.scaleType
    ? `${opt.scaleType} scale`
    : opt.zeroFalse
    ? 'scale with zero=false'
    : 'scale with custom domain that excludes zero';

  return `A ${scaleText} is used to encode ${mark}'s ${channel}. This can be misleading as the ${
    channel === 'x' ? 'width' : 'height'
  } of the ${mark} can be arbitrary based on the scale domain. You may want to use point mark instead.`;
}

export function invalidFieldTypeForCountAggregate(type: Type, aggregate: Aggregate | string) {
  return `Invalid field type "${type}" for aggregate: "${aggregate}", using "quantitative" instead.`;
}

export function invalidAggregate(aggregate: AggregateOp | string) {
  return `Invalid aggregation operator "${aggregate}".`;
}

export function missingFieldType(channel: Channel, newType: Type) {
  return `Missing type for channel "${channel}", using "${newType}" instead.`;
}
export function droppingColor(type: 'encoding' | 'property', opt: {fill?: boolean; stroke?: boolean}) {
  const {fill, stroke} = opt;
  return `Dropping color ${type} as the plot also has ${
    fill && stroke ? 'fill and stroke' : fill ? 'fill' : 'stroke'
  }.`;
}

export function emptyFieldDef(fieldDef: TypedFieldDef<string>, channel: Channel) {
  return `Dropping ${stringify(fieldDef)} from channel "${channel}" since it does not contain data field or value.`;
}
export function latLongDeprecated(channel: Channel, type: Type, newChannel: GeoPositionChannel) {
  return `${channel}-encoding with type ${type} is deprecated. Replacing with ${newChannel}-encoding.`;
}

export const LINE_WITH_VARYING_SIZE =
  'Line marks cannot encode size with a non-groupby field. You may want to use trail marks instead.';

export function incompatibleChannel(channel: Channel, markOrFacet: Mark | 'facet' | CompositeMark, when?: string) {
  return `${channel} dropped as it is incompatible with "${markOrFacet}"${when ? ` when ${when}` : ''}.`;
}

export function invalidEncodingChannel(channel: string) {
  return `${channel}-encoding is dropped as ${channel} is not a valid encoding channel.`;
}

export function facetChannelShouldBeDiscrete(channel: string) {
  return `${channel} encoding should be discrete (ordinal / nominal / binned).`;
}

export function facetChannelDropped(channels: FacetChannel[]) {
  return `Facet encoding dropped as ${channels.join(' and ')} ${channels.length > 1 ? 'are' : 'is'} also specified.`;
}

export function discreteChannelCannotEncode(channel: Channel, type: Type) {
  return `Using discrete channel "${channel}" to encode "${type}" field can be misleading as it does not encode ${
    type === 'ordinal' ? 'order' : 'magnitude'
  }.`;
}

// Mark
export function lineWithRange(hasX2: boolean, hasY2: boolean) {
  const channels = hasX2 && hasY2 ? 'x2 and y2' : hasX2 ? 'x2' : 'y2';
  return `Line mark is for continuous lines and thus cannot be used with ${channels}. We will use the rule mark (line segments) instead.`;
}

export function orientOverridden(original: string, actual: string) {
  return `Specified orient "${original}" overridden with "${actual}".`;
}

// SCALE
export const CANNOT_UNION_CUSTOM_DOMAIN_WITH_FIELD_DOMAIN =
  'Custom domain scale cannot be unioned with default field-based domain.';

export const RANGE_STEP_DEPRECATED = `Scale's "rangeStep" is deprecated and will be removed in Vega-Lite 5.0. Please use "width"/"height": {"step": ...} instead. See https://vega.github.io/vega-lite/docs/size.html.`;

export function cannotUseScalePropertyWithNonColor(prop: string) {
  return `Cannot use the scale property "${prop}" with non-color channel.`;
}

export function unaggregateDomainHasNoEffectForRawField(fieldDef: TypedFieldDef<string>) {
  return `Using unaggregated domain with raw field has no effect (${stringify(fieldDef)}).`;
}

export function unaggregateDomainWithNonSharedDomainOp(aggregate: Aggregate | string) {
  return `Unaggregated domain not applicable for "${aggregate}" since it produces values outside the origin domain of the source data.`;
}

export function unaggregatedDomainWithLogScale(fieldDef: TypedFieldDef<string>) {
  return `Unaggregated domain is currently unsupported for log scale (${stringify(fieldDef)}).`;
}

export function cannotApplySizeToNonOrientedMark(mark: Mark) {
  return `Cannot apply size to non-oriented mark "${mark}".`;
}

export function scaleTypeNotWorkWithChannel(channel: Channel, scaleType: ScaleType, defaultScaleType: ScaleType) {
  return `Channel "${channel}" does not work with "${scaleType}" scale. We are using "${defaultScaleType}" scale instead.`;
}

export function scaleTypeNotWorkWithFieldDef(scaleType: ScaleType, defaultScaleType: ScaleType) {
  return `FieldDef does not work with "${scaleType}" scale. We are using "${defaultScaleType}" scale instead.`;
}

export function scalePropertyNotWorkWithScaleType(scaleType: ScaleType, propName: string, channel: Channel) {
  return `${channel}-scale's "${propName}" is dropped as it does not work with ${scaleType} scale.`;
}

export function scaleTypeNotWorkWithMark(mark: Mark, scaleType: ScaleType) {
  return `Scale type "${scaleType}" does not work with mark "${mark}".`;
}

export function stepDropped(channel: 'width' | 'height') {
  return `The step for "${channel}" is dropped because the ${channel === 'width' ? 'x' : 'y'} is continuous.`;
}

export function mergeConflictingProperty<T>(
  property: string | number | symbol,
  propertyOf: SplitParentProperty,
  v1: T,
  v2: T
) {
  return `Conflicting ${propertyOf.toString()} property "${property.toString()}" (${stringify(v1)} and ${stringify(
    v2
  )}). Using ${stringify(v1)}.`;
}

export function mergeConflictingDomainProperty<T>(property: 'domains', propertyOf: SplitParentProperty, v1: T, v2: T) {
  return `Conflicting ${propertyOf.toString()} property "${property.toString()}" (${stringify(v1)} and ${stringify(
    v2
  )}). Using the union of the two domains.`;
}

export function independentScaleMeansIndependentGuide(channel: Channel) {
  return `Setting the scale to be independent for "${channel}" means we also have to set the guide (axis or legend) to be independent.`;
}

export function domainSortDropped(sort: VgSortField) {
  return `Dropping sort property ${stringify(
    sort
  )} as unioned domains only support boolean or op "count", "min", and "max".`;
}

export const UNABLE_TO_MERGE_DOMAINS = 'Unable to merge domains.';

export const MORE_THAN_ONE_SORT =
  'Domains that should be unioned has conflicting sort properties. Sort will be set to true.';

// AXIS
export const INVALID_CHANNEL_FOR_AXIS = 'Invalid channel for axis.';

// STACK
export function cannotStackRangedMark(channel: Channel) {
  return `Cannot stack "${channel}" if there is already "${channel}2".`;
}

export function cannotStackNonLinearScale(scaleType: ScaleType) {
  return `Cannot stack non-linear scale (${scaleType}).`;
}

export function stackNonSummativeAggregate(aggregate: Aggregate | string) {
  return `Stacking is applied even though the aggregate function is non-summative ("${aggregate}").`;
}

// TIMEUNIT
export function invalidTimeUnit(unitName: string, value: string | number) {
  return `Invalid ${unitName}: ${stringify(value)}.`;
}

export function dayReplacedWithDate(fullTimeUnit: string) {
  return `Time unit "${fullTimeUnit}" is not supported. We are replacing it with ${replaceAll(
    fullTimeUnit,
    'day',
    'date'
  )}.`;
}

export function droppedDay(d: DateTime | DateTimeExpr) {
  return `Dropping day from datetime ${stringify(d)} as day cannot be combined with other units.`;
}

export function errorBarCenterAndExtentAreNotNeeded(center: ErrorBarCenter, extent: ErrorBarExtent) {
  return `${extent ? 'extent ' : ''}${extent && center ? 'and ' : ''}${center ? 'center ' : ''}${
    extent && center ? 'are ' : 'is '
  }not needed when data are aggregated.`;
}

export function errorBarCenterIsUsedWithWrongExtent(
  center: ErrorBarCenter,
  extent: ErrorBarExtent,
  mark: 'errorbar' | 'errorband'
) {
  return `${center} is not usually used with ${extent} for ${mark}.`;
}

export function errorBarContinuousAxisHasCustomizedAggregate(
  aggregate: Aggregate | string,
  compositeMark: CompositeMark
) {
  return `Continuous axis should not have customized aggregation function ${aggregate}; ${compositeMark} already agregates the axis.`;
}

export function errorBarCenterIsNotNeeded(extent: ErrorBarExtent, mark: 'errorbar' | 'errorband') {
  return `Center is not needed to be specified in ${mark} when extent is ${extent}.`;
}

export function errorBand1DNotSupport(property: 'interpolate' | 'tension') {
  return `1D error band does not support ${property}.`;
}

// CHANNEL
export function channelRequiredForBinned(channel: Channel) {
  return `Channel ${channel} is required for "binned" bin.`;
}

export function domainRequiredForThresholdScale(channel: Channel) {
  return `Domain for ${channel} is required for threshold scale.`;
}
