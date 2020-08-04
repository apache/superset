import {AggregateOp} from 'vega';
import {BinParams} from './bin';
import {FieldName} from './channeldef';
import {Data} from './data';
import {ImputeParams} from './impute';
import {LogicalComposition, normalizeLogicalComposition} from './logical';
import {normalizePredicate, Predicate} from './predicate';
import {SortField} from './sort';
import {TimeUnit, TimeUnitParams} from './timeunit';

export interface FilterTransform {
  /**
   * The `filter` property must be a predication definition, which can takes one of the following forms:
   *
   * 1) an [expression](https://vega.github.io/vega-lite/docs/types.html#expression) string,
   * where `datum` can be used to refer to the current data object.
   * For example, `{filter: "datum.b2 > 60"}` would make the output data includes only items that have values in the field `b2` over 60.
   *
   * 2) one of the [field predicates](https://vega.github.io/vega-lite/docs/predicate.html#field-predicate): [`equal`](https://vega.github.io/* vega-lite/docs/predicate.html#field-equal-predicate),
   * [`lt`](https://vega.github.io/vega-lite/docs/predicate.html#lt-predicate),
   * [`lte`](https://vega.github.io/vega-lite/docs/predicate.html#lte-predicate),
   * [`gt`](https://vega.github.io/vega-lite/docs/predicate.html#gt-predicate),
   * [`gte`](https://vega.github.io/vega-lite/docs/predicate.html#gte-predicate),
   * [`range`](https://vega.github.io/vega-lite/docs/predicate.html#range-predicate),
   * [`oneOf`](https://vega.github.io/vega-lite/docs/predicate.html#one-of-predicate),
   * or [`valid`](https://vega.github.io/vega-lite/docs/predicate.html#valid-predicate),

   * 3) a [selection predicate](https://vega.github.io/vega-lite/docs/predicate.html#selection-predicate), which define the names of a selection that the data point should belong to (or a logical composition of selections).
   *
   * 4) a [logical composition](https://vega.github.io/vega-lite/docs/predicate.html#composition) of (1), (2), or (3).
   */
  filter: LogicalComposition<Predicate>;
}

export function isFilter(t: Transform): t is FilterTransform {
  return t['filter'] !== undefined;
}

export interface CalculateTransform {
  /**
   * A [expression](https://vega.github.io/vega-lite/docs/types.html#expression) string. Use the variable `datum` to refer to the current data object.
   */
  calculate: string;

  /**
   * The field for storing the computed formula value.
   */
  as: FieldName;
}

export interface BinTransform {
  /**
   * An object indicating bin properties, or simply `true` for using default bin parameters.
   */
  bin: true | BinParams;

  /**
   * The data field to bin.
   */
  field: FieldName;

  /**
   * The output fields at which to write the start and end bin values.
   */
  as: FieldName | FieldName[];
}

export interface TimeUnitTransform {
  /**
   * The timeUnit.
   */
  timeUnit: TimeUnit | TimeUnitParams;

  /**
   * The data field to apply time unit.
   */
  field: FieldName;

  /**
   * The output field to write the timeUnit value.
   */
  as: FieldName;
}

export interface AggregateTransform {
  /**
   * Array of objects that define fields to aggregate.
   */
  aggregate: AggregatedFieldDef[];

  /**
   * The data fields to group by. If not specified, a single group containing all data objects will be used.
   */
  groupby?: FieldName[];
}

export interface AggregatedFieldDef {
  /**
   * The aggregation operation to apply to the fields (e.g., `"sum"`, `"average"`, or `"count"`).
   * See the [full list of supported aggregation operations](https://vega.github.io/vega-lite/docs/aggregate.html#ops)
   * for more information.
   */
  op: AggregateOp;

  /**
   * The data field for which to compute aggregate function. This is required for all aggregation operations except `"count"`.
   */
  field?: FieldName;

  /**
   * The output field names to use for each aggregated field.
   */
  as: FieldName;
}

export interface StackTransform {
  /**
   * The field which is stacked.
   */
  stack: FieldName;
  /**
   * The data fields to group by.
   */
  groupby: FieldName[];
  /**
   * Mode for stacking marks. One of `"zero"` (default), `"center"`, or `"normalize"`.
   * The `"zero"` offset will stack starting at `0`. The `"center"` offset will center the stacks. The `"normalize"` offset will compute percentage values for each stack point, with output values in the range `[0,1]`.
   *
   * __Default value:__ `"zero"`
   */
  offset?: 'zero' | 'center' | 'normalize';
  /**
   * Field that determines the order of leaves in the stacked charts.
   */
  sort?: SortField[];
  /**
   * Output field names. This can be either a string or an array of strings with two elements denoting the name for the fields for stack start and stack end respectively.
   * If a single string(e.g., `"val"`) is provided, the end field will be `"val_end"`.
   */
  as: FieldName | [FieldName, FieldName];
}

export type WindowOnlyOp =
  | 'row_number'
  | 'rank'
  | 'dense_rank'
  | 'percent_rank'
  | 'cume_dist'
  | 'ntile'
  | 'lag'
  | 'lead'
  | 'first_value'
  | 'last_value'
  | 'nth_value';

export interface WindowFieldDef {
  /**
   * The window or aggregation operation to apply within a window (e.g., `"rank"`, `"lead"`, `"sum"`, `"average"` or `"count"`). See the list of all supported operations [here](https://vega.github.io/vega-lite/docs/window.html#ops).
   */
  op: AggregateOp | WindowOnlyOp;

  /**
   * Parameter values for the window functions. Parameter values can be omitted for operations that do not accept a parameter.
   *
   * See the list of all supported operations and their parameters [here](https://vega.github.io/vega-lite/docs/transforms/window.html).
   */
  param?: number;

  /**
   * The data field for which to compute the aggregate or window function. This can be omitted for window functions that do not operate over a field such as `"count"`, `"rank"`, `"dense_rank"`.
   */
  field?: FieldName;

  /**
   * The output name for the window operation.
   */
  as: FieldName;
}

export interface WindowTransform {
  /**
   * The definition of the fields in the window, and what calculations to use.
   */
  window: WindowFieldDef[];

  /**
   * A frame specification as a two-element array indicating how the sliding window should proceed. The array entries should either be a number indicating the offset from the current data object, or null to indicate unbounded rows preceding or following the current data object. The default value is `[null, 0]`, indicating that the sliding window includes the current object and all preceding objects. The value `[-5, 5]` indicates that the window should include five objects preceding and five objects following the current object. Finally, `[null, null]` indicates that the window frame should always include all data objects. If you this frame and want to assign the same value to add objects, you can use the simpler [join aggregate transform](https://vega.github.io/vega-lite/docs/joinaggregate.html). The only operators affected are the aggregation operations and the `first_value`, `last_value`, and `nth_value` window operations. The other window operations are not affected by this.
   *
   * __Default value:__:  `[null, 0]` (includes the current object and all preceding objects)
   */
  frame?: (null | number)[];

  /**
   * Indicates if the sliding window frame should ignore peer values (data that are considered identical by the sort criteria). The default is false, causing the window frame to expand to include all peer values. If set to true, the window frame will be defined by offset values only. This setting only affects those operations that depend on the window frame, namely aggregation operations and the first_value, last_value, and nth_value window operations.
   *
   * __Default value:__ `false`
   */
  ignorePeers?: boolean;

  /**
   * The data fields for partitioning the data objects into separate windows. If unspecified, all data points will be in a single window.
   */
  groupby?: FieldName[];

  /**
   * A sort field definition for sorting data objects within a window. If two data objects are considered equal by the comparator, they are considered "peer" values of equal rank. If sort is not specified, the order is undefined: data objects are processed in the order they are observed and none are considered peers (the ignorePeers parameter is ignored and treated as if set to `true`).
   */
  sort?: SortField[];
}

export interface JoinAggregateFieldDef {
  /**
   * The aggregation operation to apply (e.g., `"sum"`, `"average"` or `"count"`). See the list of all supported operations [here](https://vega.github.io/vega-lite/docs/aggregate.html#ops).
   */
  op: AggregateOp;

  /**
   * The data field for which to compute the aggregate function. This can be omitted for functions that do not operate over a field such as `"count"`.
   */
  field?: FieldName;

  /**
   * The output name for the join aggregate operation.
   */
  as: FieldName;
}

export interface JoinAggregateTransform {
  /**
   * The definition of the fields in the join aggregate, and what calculations to use.
   */
  joinaggregate: JoinAggregateFieldDef[];

  /**
   * The data fields for partitioning the data objects into separate groups. If unspecified, all data points will be in a single group.
   */
  groupby?: FieldName[];
}

export interface ImputeSequence {
  /**
   * The starting value of the sequence.
   * __Default value:__ `0`
   */
  start?: number;
  /**
   * The ending value(exclusive) of the sequence.
   */
  stop: number;
  /**
   * The step value between sequence entries.
   * __Default value:__ `1` or `-1` if `stop < start`
   */
  step?: number;
}

export function isImputeSequence(t: ImputeSequence | any[] | undefined): t is ImputeSequence {
  return t?.['stop'] !== undefined;
}

export interface ImputeTransform extends ImputeParams {
  /**
   * The data field for which the missing values should be imputed.
   */
  impute: FieldName;

  /**
   * A key field that uniquely identifies data objects within a group.
   * Missing key values (those occurring in the data but not in the current group) will be imputed.
   */
  key: FieldName;

  /**
   * An optional array of fields by which to group the values.
   * Imputation will then be performed on a per-group basis.
   */
  groupby?: FieldName[];
}

export interface FlattenTransform {
  /**
   * An array of one or more data fields containing arrays to flatten.
   * If multiple fields are specified, their array values should have a parallel structure, ideally with the same length.
   * If the lengths of parallel arrays do not match,
   * the longest array will be used with `null` values added for missing entries.
   */
  flatten: FieldName[];

  /**
   * The output field names for extracted array values.
   *
   * __Default value:__ The field name of the corresponding array field
   */
  as?: FieldName[];
}

export interface SampleTransform {
  /**
   * The maximum number of data objects to include in the sample.
   *
   * __Default value:__ `1000`
   */
  sample: number;
}

export interface LookupBase {
  /**
   * Key in data to lookup.
   */
  key: FieldName;
  /**
   * Fields in foreign data or selection to lookup.
   * If not specified, the entire object is queried.
   */
  fields?: FieldName[];
}

export interface LookupData extends LookupBase {
  /**
   * Secondary data source to lookup in.
   */
  data: Data;
}

export interface LookupSelection extends LookupBase {
  /**
   * Selection name to look up.
   */
  selection: string;
}

export interface LookupTransform {
  /**
   * Key in primary data source.
   */
  lookup: string;

  /**
   * The output fields on which to store the looked up data values.
   *
   * For data lookups, this property may be left blank if `from.fields`
   * has been specified (those field names will be used); if `from.fields`
   * has not been specified, `as` must be a string.
   *
   * For selection lookups, this property is optional: if unspecified,
   * looked up values will be stored under a property named for the selection;
   * and if specified, it must correspond to `from.fields`.
   */
  as?: FieldName | FieldName[];

  /**
   * The default value to use if lookup fails.
   *
   * __Default value:__ `null`
   */
  default?: string;

  /**
   * Data source or selection for secondary data reference.
   */
  from: LookupData | LookupSelection;
}

export function isLookup(t: Transform): t is LookupTransform {
  return t['lookup'] !== undefined;
}

export function isLookupData(from: LookupData | LookupSelection): from is LookupData {
  return from['data'] !== undefined;
}

export function isLookupSelection(from: LookupData | LookupSelection): from is LookupData {
  return from['selection'] !== undefined;
}

export interface FoldTransform {
  /**
   * An array of data fields indicating the properties to fold.
   */
  fold: FieldName[];

  /**
   * The output field names for the key and value properties produced by the fold transform.
   * __Default value:__ `["key", "value"]`
   */
  as?: [FieldName, FieldName];
}

export interface PivotTransform {
  /**
   * The data field to pivot on. The unique values of this field become new field names in the output stream.
   */
  pivot: FieldName;

  /**
   * The data field to populate pivoted fields. The aggregate values of this field become the values of the new pivoted fields.
   */
  value: FieldName;

  /**
   * The optional data fields to group by. If not specified, a single group containing all data objects will be used.
   */
  groupby?: FieldName[];

  /**
   * An optional parameter indicating the maximum number of pivoted fields to generate.
   * The default (`0`) applies no limit. The pivoted `pivot` names are sorted in ascending order prior to enforcing the limit.
   * __Default value:__ `0`
   */
  limit?: number;

  /**
   * The aggregation operation to apply to grouped `value` field values.
   * __Default value:__ `sum`
   */
  op?: string;
}

export function isPivot(t: Transform): t is PivotTransform {
  return t['pivot'] !== undefined;
}

export interface DensityTransform {
  /**
   * The data field for which to perform density estimation.
   */
  density: FieldName;

  /**
   * The data fields to group by. If not specified, a single group containing all data objects will be used.
   */
  groupby?: FieldName[];

  /**
   * A boolean flag indicating whether to produce density estimates (false) or cumulative density estimates (true).
   *
   * __Default value:__ `false`
   */
  cumulative?: boolean;

  /**
   * A boolean flag indicating if the output values should be probability estimates (false) or smoothed counts (true).
   *
   * __Default value:__ `false`
   */
  counts?: boolean;

  /**
   * The bandwidth (standard deviation) of the Gaussian kernel. If unspecified or set to zero, the bandwidth value is automatically estimated from the input data using Scott’s rule.
   */
  bandwidth?: number;

  /**
   * A [min, max] domain from which to sample the distribution. If unspecified, the extent will be determined by the observed minimum and maximum values of the density value field.
   */
  extent?: [number, number];

  /**
   * The minimum number of samples to take along the extent domain for plotting the density.
   *
   * __Default value:__ `25`
   */
  minsteps?: number;

  /**
   * The maximum number of samples to take along the extent domain for plotting the density.
   *
   * __Default value:__ `200`
   */
  maxsteps?: number;

  /**
   * The exact number of samples to take along the extent domain for plotting the density. If specified, overrides both minsteps and maxsteps to set an exact number of uniform samples. Potentially useful in conjunction with a fixed extent to ensure consistent sample points for stacked densities.
   */
  steps?: number;

  /**
   * The output fields for the sample value and corresponding density estimate.
   *
   * __Default value:__ `["value", "density"]`
   */
  as?: [FieldName, FieldName];
}

export function isDensity(t: Transform): t is DensityTransform {
  return t['density'] !== undefined;
}

export interface QuantileTransform {
  /**
   * The data field for which to perform quantile estimation.
   */
  quantile: FieldName;

  /**
   * The data fields to group by. If not specified, a single group containing all data objects will be used.
   */
  groupby?: FieldName[];

  /**
   * An array of probabilities in the range (0, 1) for which to compute quantile values. If not specified, the *step* parameter will be used.
   */
  probs?: number[];

  /**
   * A probability step size (default 0.01) for sampling quantile values. All values from one-half the step size up to 1 (exclusive) will be sampled. This parameter is only used if the *probs* parameter is not provided.
   */
  step?: number;

  /**
   * The output field names for the probability and quantile values.
   *
   * __Default value:__ `["prob", "value"]`
   */
  as?: [FieldName, FieldName];
}

export function isQuantile(t: Transform): t is QuantileTransform {
  return t['quantile'] !== undefined;
}

export interface RegressionTransform {
  /**
   * The data field of the dependent variable to predict.
   */
  regression: FieldName;

  /**
   * The data field of the independent variable to use a predictor.
   */
  on: FieldName;

  /**
   * The data fields to group by. If not specified, a single group containing all data objects will be used.
   */
  groupby?: FieldName[];

  /**
   * The functional form of the regression model. One of `"linear"`, `"log"`, `"exp"`, `"pow"`, `"quad"`, or `"poly"`.
   *
   * __Default value:__ `"linear"`
   */
  method?: 'linear' | 'log' | 'exp' | 'pow' | 'quad' | 'poly';

  /**
   * The polynomial order (number of coefficients) for the 'poly' method.
   *
   * __Default value:__ `3`
   */
  order?: number;

  /**
   * A [min, max] domain over the independent (x) field for the starting and ending points of the generated trend line.
   */
  extent?: [number, number];

  /**
   * A boolean flag indicating if the transform should return the regression model parameters (one object per group), rather than trend line points.
   * The resulting objects include a `coef` array of fitted coefficient values (starting with the intercept term and then including terms of increasing order)
   * and an `rSquared` value (indicating the total variance explained by the model).
   *
   * __Default value:__ `false`
   */
  params?: boolean;

  /**
   * The output field names for the smoothed points generated by the regression transform.
   *
   * __Default value:__ The field names of the input x and y values.
   */
  as?: [FieldName, FieldName];
}

export function isRegression(t: Transform): t is RegressionTransform {
  return t['regression'] !== undefined;
}

export interface LoessTransform {
  /**
   * The data field of the dependent variable to smooth.
   */
  loess: FieldName;

  /**
   * The data field of the independent variable to use a predictor.
   */
  on: FieldName;

  /**
   * The data fields to group by. If not specified, a single group containing all data objects will be used.
   */
  groupby?: FieldName[];

  /**
   * A bandwidth parameter in the range `[0, 1]` that determines the amount of smoothing.
   *
   * __Default value:__ `0.3`
   */
  bandwidth?: number;

  /**
   * The output field names for the smoothed points generated by the loess transform.
   *
   * __Default value:__ The field names of the input x and y values.
   */
  as?: [FieldName, FieldName];
}

export function isLoess(t: Transform): t is LoessTransform {
  return t['loess'] !== undefined;
}

export function isSample(t: Transform): t is SampleTransform {
  return t['sample'] !== undefined;
}

export function isWindow(t: Transform): t is WindowTransform {
  return t['window'] !== undefined;
}

export function isJoinAggregate(t: Transform): t is JoinAggregateTransform {
  return t['joinaggregate'] !== undefined;
}

export function isFlatten(t: Transform): t is FlattenTransform {
  return t['flatten'] !== undefined;
}
export function isCalculate(t: Transform): t is CalculateTransform {
  return t['calculate'] !== undefined;
}

export function isBin(t: Transform): t is BinTransform {
  return !!t['bin'];
}

export function isImpute(t: Transform): t is ImputeTransform {
  return t['impute'] !== undefined;
}

export function isTimeUnit(t: Transform): t is TimeUnitTransform {
  return t['timeUnit'] !== undefined;
}

export function isAggregate(t: Transform): t is AggregateTransform {
  return t['aggregate'] !== undefined;
}

export function isStack(t: Transform): t is StackTransform {
  return t['stack'] !== undefined;
}

export function isFold(t: Transform): t is FoldTransform {
  return t['fold'] !== undefined;
}

export type Transform =
  | AggregateTransform
  | BinTransform
  | CalculateTransform
  | DensityTransform
  | FilterTransform
  | FlattenTransform
  | FoldTransform
  | ImputeTransform
  | JoinAggregateTransform
  | LoessTransform
  | LookupTransform
  | QuantileTransform
  | RegressionTransform
  | TimeUnitTransform
  | SampleTransform
  | StackTransform
  | WindowTransform
  | PivotTransform;

export function normalizeTransform(transform: Transform[]) {
  return transform.map(t => {
    if (isFilter(t)) {
      return {
        filter: normalizeLogicalComposition(t.filter, normalizePredicate)
      };
    }
    return t;
  });
}
