import {BaseSpec, BoundsMixins, GenericCompositionLayoutWithColumns, ResolveMixins} from './base';
import {GenericSpec} from '.';
import {GenericLayerSpec, NormalizedLayerSpec} from './layer';
import {GenericUnitSpec, NormalizedUnitSpec} from './unit';

/**
 * Base layout mixins for V/HConcatSpec, which should not have RowCol<T> generic fo its property.
 */
export interface OneDirectionalConcatLayout extends BoundsMixins, ResolveMixins {
  /**
   * Boolean flag indicating if subviews should be centered relative to their respective rows or columns.
   *
   * __Default value:__ `false`
   */
  center?: boolean;

  /**
   * The spacing in pixels between sub-views of the concat operator.
   *
   * __Default value__: `10`
   */
  spacing?: number;
}

/**
 * Base interface for a generalized concatenation specification.
 */
export interface GenericConcatSpec<U extends GenericUnitSpec<any, any>, L extends GenericLayerSpec<any>>
  extends BaseSpec,
    GenericCompositionLayoutWithColumns,
    ResolveMixins {
  /**
   * A list of views to be concatenated.
   */
  concat: GenericSpec<U, L>[];
}

/**
 * Base interface for a vertical concatenation specification.
 */
export interface GenericVConcatSpec<U extends GenericUnitSpec<any, any>, L extends GenericLayerSpec<any>>
  extends BaseSpec,
    OneDirectionalConcatLayout {
  /**
   * A list of views to be concatenated and put into a column.
   */
  vconcat: GenericSpec<U, L>[];
}

/**
 * Base interface for a horizontal concatenation specification.
 */
export interface GenericHConcatSpec<U extends GenericUnitSpec<any, any>, L extends GenericLayerSpec<any>>
  extends BaseSpec,
    OneDirectionalConcatLayout {
  /**
   * A list of views to be concatenated and put into a row.
   */
  hconcat: GenericSpec<U, L>[];
}

/** A concat spec without any shortcut/expansion syntax */
export type NormalizedConcatSpec =
  | GenericConcatSpec<NormalizedUnitSpec, NormalizedLayerSpec>
  | GenericVConcatSpec<NormalizedUnitSpec, NormalizedLayerSpec>
  | GenericHConcatSpec<NormalizedUnitSpec, NormalizedLayerSpec>;

export function isAnyConcatSpec(spec: BaseSpec): spec is GenericVConcatSpec<any, any> | GenericHConcatSpec<any, any> {
  return isVConcatSpec(spec) || isHConcatSpec(spec) || isConcatSpec(spec);
}

export function isConcatSpec(spec: BaseSpec): spec is GenericConcatSpec<any, any> {
  return spec['concat'] !== undefined;
}

export function isVConcatSpec(spec: BaseSpec): spec is GenericVConcatSpec<any, any> {
  return spec['vconcat'] !== undefined;
}

export function isHConcatSpec(spec: BaseSpec): spec is GenericHConcatSpec<any, any> {
  return spec['hconcat'] !== undefined;
}
