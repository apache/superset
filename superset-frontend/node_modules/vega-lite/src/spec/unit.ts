import {Field} from '../channeldef';
import {CompositeEncoding, FacetedCompositeEncoding} from '../compositemark';
import {Encoding} from '../encoding';
import {AnyMark, Mark, MarkDef} from '../mark';
import {Projection} from '../projection';
import {SelectionDef} from '../selection';
import {BaseSpec, BoundsMixins, DataMixins, FrameMixins, ResolveMixins} from './base';
import {TopLevel} from './toplevel';

/**
 * Base interface for a unit (single-view) specification.
 */
export interface GenericUnitSpec<E extends Encoding<any>, M> extends BaseSpec {
  /**
   * A string describing the mark type (one of `"bar"`, `"circle"`, `"square"`, `"tick"`, `"line"`,
   * `"area"`, `"point"`, `"rule"`, `"geoshape"`, and `"text"`) or a [mark definition object](https://vega.github.io/vega-lite/docs/mark.html#mark-def).
   */
  mark: M;

  /**
   * A key-value mapping between encoding channels and definition of fields.
   */
  encoding?: E;

  /**
   * An object defining properties of geographic projection, which will be applied to `shape` path for `"geoshape"` marks
   * and to `latitude` and `"longitude"` channels for other marks.
   */
  projection?: Projection;

  /**
   * A key-value mapping between selection names and definitions.
   */
  selection?: {[name: string]: SelectionDef};
}

/**
 * A unit specification without any shortcut/expansion syntax.
 */
export type NormalizedUnitSpec = GenericUnitSpec<Encoding<Field>, Mark | MarkDef>;

/**
 * A unit specification, which can contain either [primitive marks or composite marks](https://vega.github.io/vega-lite/docs/mark.html#types).
 */
export type UnitSpec = GenericUnitSpec<CompositeEncoding, AnyMark>;

export type UnitSpecWithFrame = GenericUnitSpec<CompositeEncoding, AnyMark> & FrameMixins;

/**
 * Unit spec that can have a composite mark and row or column channels (shorthand for a facet spec).
 */
export type FacetedUnitSpec = GenericUnitSpec<FacetedCompositeEncoding, AnyMark> &
  ResolveMixins &
  BoundsMixins &
  FrameMixins;

export type TopLevelUnitSpec = TopLevel<FacetedUnitSpec> & DataMixins;

export function isUnitSpec(spec: BaseSpec): spec is FacetedUnitSpec | NormalizedUnitSpec {
  return !!spec['mark'];
}
