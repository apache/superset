import {
  Compare,
  ExprRef,
  FontStyle,
  FontWeight,
  SignalRef,
  Vector2,
  Vector4,
  Vector5,
  Vector6,
  Vector7,
} from '.';

export type DataName = string;

export type ProjectionName = string;

export type SignalName = string;

export type ExprString = string;

export interface FieldParam {
  field: string;
}

export type TransformField = SignalRef | FieldParam | ExprRef;

export type FieldRef = string | TransformField;

export type Transforms =
  | AggregateTransform
  | BinTransform
  | CollectTransform
  | CountPatternTransform
  | ContourTransform
  | CrossTransform
  | CrossFilterTransform
  | DensityTransform
  | DotBinTransform
  | ExtentTransform
  | FilterTransform
  | FlattenTransform
  | FoldTransform
  | ForceTransform
  | FormulaTransform
  | HeatmapTransform
  | GeoJSONTransform
  | GeoPathTransform
  | GeoPointTransform
  | GeoShapeTransform
  | GraticuleTransform
  | IdentifierTransform
  | ImputeTransform
  | IsocontourTransform
  | JoinAggregateTransform
  | KDETransform
  | KDE2DTransform
  | LabelTransform
  | LinkPathTransform
  | LoessTransform
  | LookupTransform
  | NestTransform
  | PackTransform
  | PartitionTransform
  | PieTransform
  | PivotTransform
  | ProjectTransform
  | QuantileTransform
  | RegressionTransform
  | ResolveFilterTransform
  | SampleTransform
  | SequenceTransform
  | StackTransform
  | StratifyTransform
  | TimeUnitTransform
  | TreeTransform
  | TreeLinksTransform
  | TreemapTransform
  | VoronoiTransform
  | WindowTransform
  | WordcloudTransform;

export interface AggregateTransform {
  type: 'aggregate';
  signal?: string;
  groupby?: FieldRef[] | SignalRef;
  fields?: (FieldRef | null)[] | SignalRef;
  ops?: (AggregateOp | SignalRef)[] | SignalRef;
  as?: (string | SignalRef | null)[] | SignalRef;
  drop?: boolean | SignalRef;
  cross?: boolean | SignalRef;
  key?: string | TransformField;
}
export type AggregateOp =
  | 'argmax'
  | 'argmin'
  | 'average'
  | 'count'
  | 'distinct'
  | 'max'
  | 'mean'
  | 'median'
  | 'min'
  | 'missing'
  | 'product'
  | 'q1'
  | 'q3'
  | 'ci0'
  | 'ci1'
  | 'stderr'
  | 'stdev'
  | 'stdevp'
  | 'sum'
  | 'valid'
  | 'values'
  | 'variance'
  | 'variancep';

export interface BinTransform extends BaseBin {
  type: 'bin';
  field: FieldRef;
  interval?: boolean | SignalRef;
  anchor?: number | SignalRef;
  extent: Vector2<number | SignalRef> | SignalRef;
  span?: number | SignalRef;
  signal?: SignalName;
  name?: string | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}
export interface BaseBin {
  /**
   * The number base to use for automatic bin determination (default is base 10).
   *
   * __Default value:__ `10`
   *
   */
  base?: number | SignalRef;
  /**
   * An exact step size to use between bins.
   *
   * __Note:__ If provided, options such as maxbins will be ignored.
   */
  step?: number | SignalRef;
  /**
   * An array of allowable step sizes to choose from.
   * @minItems 1
   */
  steps?: (number | SignalRef)[] | SignalRef;
  /**
   * A minimum allowable step size (particularly useful for integer values).
   */
  minstep?: number | SignalRef;
  /**
   * Scale factors indicating allowable subdivisions. The default value is [5, 2], which indicates that for base 10 numbers (the default base), the method may consider dividing bin sizes by 5 and/or 2. For example, for an initial step size of 10, the method can check if bin sizes of 2 (= 10/5), 5 (= 10/2), or 1 (= 10/(5*2)) might also satisfy the given constraints.
   *
   * __Default value:__ `[5, 2]`
   *
   * @minItems 1
   */
  divide?: Vector2<number | SignalRef> | SignalRef;
  /**
   * Maximum number of bins.
   *
   * __Default value:__ `6` for `row`, `column` and `shape` channels; `10` for other channels
   *
   * @minimum 2
   */
  maxbins?: number | SignalRef;
  /**
   * If true (the default), attempts to make the bin boundaries use human-friendly boundaries, such as multiples of ten.
   */
  nice?: boolean | SignalRef;
}

export interface CollectTransform {
  type: 'collect';
  sort: Compare;
}

export interface CountPatternTransform {
  type: 'countpattern';
  field: FieldRef;
  case?: string | SignalRef;
  pattern?: string | SignalRef;
  stopwords?: string | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}

export type ContourTransform = {
  type: 'contour';
  signal?: string;
  size: (number | SignalRef)[] | SignalRef; // TODO: change to Vector2<number | SignalRef> after https://github.com/Microsoft/TypeScript/issues/28017 has been fixed
  values?: (number | SignalRef)[] | SignalRef;
  x?: FieldRef;
  y?: FieldRef;
  cellSize?: number | SignalRef;
  bandwidth?: number | SignalRef;
} & (
  | {
      count?: number | SignalRef;
      nice?: number | SignalRef;
    }
  | {
      thresholds?: (number | SignalRef)[] | SignalRef;
    }
);

export interface CrossTransform {
  type: 'cross';
  filter?: ExprString;
  as?: Vector2<string | SignalRef> | SignalRef;
}

export interface CrossFilterTransform {
  type: 'crossfilter';
  fields: (string | TransformField)[] | SignalRef;
  query: (Vector2<number | SignalRef> | SignalRef)[] | SignalRef;
  signal?: SignalName;
}

export interface DensityTransform {
  type: 'density';
  extent?: Vector2<number | SignalRef> | SignalRef;
  steps?: number | SignalRef;
  minsteps?: number | SignalRef;
  maxsteps?: number | SignalRef;
  method?: DensityMethod | SignalRef;
  distribution?: Distribution | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}
export type DensityMethod = 'pdf' | 'cdf';
export interface DistributionNormal {
  function: 'normal';
  mean?: number | SignalRef;
  stdev?: number | SignalRef;
}
export interface DistributionLogNormal {
  function: 'lognormal';
  mean?: number | SignalRef;
  stdev?: number | SignalRef;
}
export interface DistributionUniform {
  function: 'uniform';
  min?: number | SignalRef;
  max?: number | SignalRef;
}
export interface DistributionKDE {
  function: 'kde';
  field: string | TransformField;
  from?: DataName;
  bandwidth?: number | SignalRef;
}
export interface DistributionMixture {
  function: 'mixture';
  field: string | TransformField;
  distributions?: (Distribution | SignalRef)[] | SignalRef;
  weights?: (number | SignalRef)[] | SignalRef;
}
export type Distribution =
  | DistributionNormal
  | DistributionLogNormal
  | DistributionUniform
  | DistributionKDE
  | DistributionMixture;

export interface DotBinTransform {
  type: 'dotbin';
  field: FieldRef;
  groupby?: FieldRef[] | SignalRef;
  step?: number | SignalRef;
  smooth?: boolean | SignalRef;
  as?: string | SignalRef;
  signal?: SignalName;
}

export interface ExtentTransform {
  type: 'extent';
  field: FieldRef;
  signal?: string;
}

export interface FilterTransform {
  type: 'filter';
  expr: ExprString;
}

export interface FlattenTransform {
  type: 'flatten';
  fields: FieldRef[] | SignalRef;
  index?: string | SignalRef;
  as?: (string | SignalRef)[] | SignalRef;
}

export interface FoldTransform {
  type: 'fold';
  fields: FieldRef[] | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}

export interface ForceTransform {
  type: 'force';
  static?: boolean | SignalRef;
  restart?: boolean | SignalRef;
  iterations?: number | SignalRef;
  alpha?: number | SignalRef;
  alphaMin?: number | SignalRef;
  alphaTarget?: number | SignalRef;
  velocityDecay?: number | SignalRef;
  forces?: (Force | SignalRef)[] | SignalRef;
  signal?: SignalName;
}
export interface ForceCenter {
  force: 'center';
  x?: number | SignalRef;
  y?: number | SignalRef;
}
export interface ForceCollide {
  force: 'collide';
  radius?: number | SignalRef | ExprRef;
  strength?: number | SignalRef;
  iterations?: number | SignalRef;
}
export interface ForceLink {
  force: 'link';
  links?: DataName;
  id?: FieldRef;
  distance?: number | SignalRef | ExprRef;
  strength?: number | SignalRef | ExprRef;
  iterations?: number | SignalRef;
}
export interface ForceNBody {
  force: 'nbody';
  strength?: number | SignalRef;
  theta?: number | SignalRef;
  distanceMin?: number | SignalRef;
  distanceMax?: number | SignalRef;
}
export interface ForceX {
  force: 'x';
  strength?: number | SignalRef;
  x?: FieldRef;
}
export interface ForceY {
  force: 'y';
  strength?: number | SignalRef;
  y?: FieldRef;
}
export type Force = ForceCenter | ForceCollide | ForceLink | ForceNBody | ForceX | ForceY;

export interface FormulaTransform {
  type: 'formula';
  expr: ExprString;
  initonly?: boolean;
  as: string | SignalRef;
}

export interface GeoJSONTransform {
  type: 'geojson';
  fields?: Vector2<FieldRef> | SignalRef;
  geojson?: FieldRef;
  signal?: SignalName;
}

export interface GeoPointTransform {
  type: 'geopoint';
  projection: ProjectionName;
  fields: Vector2<FieldRef> | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}

export interface GeoPathTransform {
  type: 'geopath';
  projection?: ProjectionName;
  field?: FieldRef;
  pointRadius?: number | SignalRef | ExprRef;
  as?: string | SignalRef;
}

export interface GeoShapeTransform {
  type: 'geoshape';
  projection?: ProjectionName;
  field?: FieldRef;
  pointRadius?: number | SignalRef | ExprRef;
  as?: string | SignalRef;
}

export interface GraticuleTransform {
  type: 'graticule';
  signal?: SignalName;
  extent?: Vector2<Vector2<number | SignalRef> | SignalRef> | SignalRef;
  extentMajor?: Vector2<Vector2<number | SignalRef> | SignalRef> | SignalRef;
  extentMinor?: Vector2<Vector2<number | SignalRef> | SignalRef> | SignalRef;
  step?: Vector2<number | SignalRef> | SignalRef;
  stepMajor?: Vector2<number | SignalRef> | SignalRef;
  stepMinor?: Vector2<number | SignalRef> | SignalRef;
  precision?: number | SignalRef;
}

export interface HeatmapTransform {
  type: 'heatmap';
  field?: string | TransformField;
  color?: string | TransformField;
  opacity?: number | TransformField;
  resolve?: 'independent' | 'shared' | SignalRef;
  as?: string | SignalRef;
}

export interface IdentifierTransform {
  type: 'identifier';
  as: string | SignalRef;
}

export interface ImputeTransform {
  type: 'impute';
  field: FieldRef;
  key: FieldRef;
  keyvals?: any[] | SignalRef;
  groupby?: FieldRef[] | SignalRef;
  method?: ImputeMethod | SignalRef;
  value?: any; // includes SignalRef
}
export type ImputeMethod = 'value' | 'median' | 'max' | 'min' | 'mean';

export interface IsocontourTransform {
  type: 'isocontour';
  field?: string | TransformField;
  scale?: number | TransformField;
  translate?: number[] | TransformField;
  levels?: number | SignalRef;
  smooth?: boolean | SignalRef;
  nice?: boolean | SignalRef;
  zero?: boolean | SignalRef;
  resolve?: 'shared' | 'independent' | SignalRef;
  thresholds?: (number | SignalRef)[] | SignalRef;
  as?: string | null | SignalRef;
}

export interface JoinAggregateTransform {
  type: 'joinaggregate';
  groupby?: FieldRef[] | SignalRef;
  ops?: (AggregateOp | SignalRef)[] | SignalRef;
  fields?: (FieldRef | null)[] | SignalRef;
  as?: (string | SignalRef | null)[] | SignalRef;
}

export interface KDETransform {
  type: 'kde';
  field: FieldRef;
  groupby?: FieldRef[] | SignalRef;
  cumulative?: boolean | SignalRef;
  counts?: boolean | SignalRef;
  bandwidth?: number | SignalRef;
  extent?: Vector2<number | SignalRef> | SignalRef;
  resolve?: KDEResolve | SignalRef;
  steps?: number | SignalRef;
  minsteps?: number | SignalRef;
  maxsteps?: number | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}
export type KDEResolve = 'shared' | 'independent';

export interface LinkPathTransform {
  type: 'linkpath';
  sourceX?: FieldRef;
  sourceY?: FieldRef;
  targetX?: FieldRef;
  targetY?: FieldRef;
  orient?: LinkPathOrient | SignalRef;
  shape?: LinkPathShape | SignalRef;
  require?: SignalRef;
  as?: string | SignalRef;
}
export type LinkPathOrient = 'horizontal' | 'vertical' | 'radial';
export type LinkPathShape = 'line' | 'arc' | 'curve' | 'diagonal' | 'orthogonal';

export interface KDE2DTransform {
  type: 'kde2d';
  size: (number | SignalRef)[] | SignalRef; // TODO: change to Vector2<number | SignalRef> after https://github.com/Microsoft/TypeScript/issues/28017 has been fixed
  x: string | TransformField;
  y: string | TransformField;
  groupby?: (string | TransformField)[] | SignalRef;
  weight?: string | TransformField;
  cellSize?: number | SignalRef;
  bandwidth?: (number | SignalRef)[] | SignalRef; // TODO: change to Vector2<number | SignalRef> after https://github.com/Microsoft/TypeScript/issues/28017 has been fixed
  counts?: boolean | SignalRef;
  as?: string | SignalRef;
}

export interface LoessTransform {
  type: 'loess';
  x: FieldRef;
  y: FieldRef;
  groupby?: FieldRef[] | SignalRef;
  bandwidth?: number | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}

export interface LabelTransform {
  type: 'label';
  size: Vector2<number | SignalRef> | SignalRef;
  sort?: Compare;
  offset?: number[] | number | SignalRef;
  anchor?: string[] | string | SignalRef;
  padding?: number | SignalRef;
  markIndex?: number;
  lineAnchor?: 'begin' | 'end' | SignalRef;
  avoidBaseMark?: boolean | SignalRef;
  avoidMarks?: string[];
  as?: Vector7<string | SignalRef> | SignalRef;
}

export interface LookupTransform {
  type: 'lookup';
  from: DataName;
  key: FieldRef;
  fields: FieldRef[] | SignalRef;
  values?: FieldRef[] | SignalRef;
  as?: (string | SignalRef)[] | SignalRef;
  default?: any; // includes SignalRef
}

export interface NestTransform {
  type: 'nest';
  keys?: FieldRef[] | SignalRef;
  generate?: boolean | SignalRef;
}

export interface PackTransform {
  type: 'pack';
  field?: FieldRef;
  sort?: Compare;
  padding?: number | SignalRef;
  radius?: FieldRef;
  size?: Vector2<number | SignalRef> | SignalRef;
  as?: Vector5<string | SignalRef> | SignalRef;
}

export interface PartitionTransform {
  type: 'partition';
  field?: FieldRef;
  sort?: Compare;
  padding?: number | SignalRef;
  round?: boolean | SignalRef;
  size?: Vector2<number | SignalRef> | SignalRef;
  as?: Vector6<string | SignalRef> | SignalRef;
}

export interface PieTransform {
  type: 'pie';
  field?: FieldRef;
  startAngle?: number | SignalRef;
  endAngle?: number | SignalRef;
  sort?: boolean | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}

export interface PivotTransform {
  type: 'pivot';
  field: FieldRef;
  value: FieldRef;
  groupby?: FieldRef[] | SignalRef;
  limit?: number | SignalRef;
  op?: string | SignalRef;
  key?: string | TransformField;
}

export interface ProjectTransform {
  type: 'project';
  fields?: FieldRef[] | SignalRef;
  as?: (string | SignalRef | null)[] | SignalRef;
}

export interface QuantileTransform {
  type: 'quantile';
  field: FieldRef;
  groupby?: FieldRef[] | SignalRef;
  step?: number | SignalRef;
  probs?: number[] | SignalRef;
  as?: (string | SignalRef)[] | SignalRef;
}

export interface RegressionTransform {
  type: 'regression';
  x: FieldRef;
  y: FieldRef;
  groupby?: FieldRef[] | SignalRef;
  method?: RegressionMethod | SignalRef;
  order?: number | SignalRef;
  extent?: [number, number] | SignalRef;
  params?: boolean | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}
export type RegressionMethod = 'linear' | 'exp' | 'log' | 'quad' | 'poly' | 'pow';

export interface ResolveFilterTransform {
  type: 'resolvefilter';
  ignore: number | SignalRef;
  filter: SignalRef;
}

export interface SampleTransform {
  type: 'sample';
  size: number | SignalRef;
}

export interface SequenceTransform {
  type: 'sequence';
  start: number | SignalRef;
  stop: number | SignalRef;
  step?: number | SignalRef;
  as?: string | SignalRef;
}

export interface StackTransform {
  type: 'stack';
  field?: FieldRef;
  groupby?: FieldRef[];
  sort?: Compare;
  offset?: StackOffset | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
}
export type StackOffset = 'zero' | 'center' | 'normalize';

export interface StratifyTransform {
  type: 'stratify';
  key: FieldRef;
  parentKey: FieldRef;
}

export interface TimeUnitTransform {
  type: 'timeunit';
  field: FieldRef;
  interval?: boolean | SignalRef;
  units?: (TimeUnit | SignalRef)[] | SignalRef;
  step?: number | SignalRef;
  timezone?: TimeZone | SignalRef;
  as?: Vector2<string | SignalRef> | SignalRef;
  signal?: SignalName;
}
export type TimeZone = 'local' | 'utc';
export type TimeUnit =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'date'
  | 'dayofyear'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'milliseconds';

export interface TreeTransform {
  type: 'tree';
  field?: FieldRef;
  sort?: Compare;
  method?: TreeMethod | SignalRef;
  size?: Vector2<number | SignalRef> | SignalRef;
  nodeSize?: Vector2<number | SignalRef> | SignalRef;
  separation?: boolean | SignalRef;
  as?: Vector4<string | SignalRef> | SignalRef;
}
export type TreeMethod = 'tidy' | 'cluster';

export interface TreeLinksTransform {
  type: 'treelinks';
}

export interface TreemapTransform {
  type: 'treemap';
  field?: FieldRef;
  sort?: Compare;
  method?: TreemapMethod | SignalRef;
  padding?: number | SignalRef;
  paddingInner?: number | SignalRef;
  paddingOuter?: number | SignalRef;
  paddingTop?: number | SignalRef;
  paddingRight?: number | SignalRef;
  paddingBottom?: number | SignalRef;
  paddingLeft?: number | SignalRef;
  ratio?: number | SignalRef;
  round?: boolean | SignalRef;
  size?: Vector2<number | SignalRef> | SignalRef;
  as?: Vector6<string | SignalRef> | SignalRef;
}
export type TreemapMethod = 'squarify' | 'resquarify' | 'binary' | 'dice' | 'slice' | 'slicedice';

export interface VoronoiTransform {
  type: 'voronoi';
  x: FieldRef;
  y: FieldRef;
  size?: Vector2<number | SignalRef> | SignalRef;
  extent?: Vector2<Vector2<number | SignalRef> | SignalRef> | SignalRef;
  as?: string | SignalRef;
}

export interface WindowTransform {
  type: 'window';
  sort?: Compare;
  groupby?: FieldRef[] | SignalRef;
  ops?: (AggregateOp | WindowOnlyOp | SignalRef)[];
  params?: (number | SignalRef | null)[] | SignalRef;
  fields?: (FieldRef | null)[] | SignalRef;
  as?: (string | SignalRef | null)[] | SignalRef;
  frame?: Vector2<number | SignalRef | null> | SignalRef;
  ignorePeers?: boolean | SignalRef;
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
  | 'nth_value'
  | 'prev_value'
  | 'next_value';

export interface WordcloudTransform {
  type: 'wordcloud';
  size?: Vector2<number | SignalRef> | SignalRef;
  font?: string | TransformField;
  fontStyle?: FontStyle | TransformField;
  fontWeight?: FontWeight | TransformField;
  fontSize?: number | TransformField;
  fontSizeRange?: Vector2<number | SignalRef> | SignalRef;
  rotate?: number | TransformField;
  text?: string | TransformField;
  spiral?: WordcloudSpiral | SignalRef;
  padding?: number | TransformField;
  as?: Vector7<string | SignalRef> | SignalRef;
}
export type WordcloudSpiral = 'archimedian' | 'rectangular';
