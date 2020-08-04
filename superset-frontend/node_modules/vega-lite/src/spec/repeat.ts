import {BaseSpec, GenericCompositionLayoutWithColumns, ResolveMixins} from './base';
import {GenericSpec} from '.';
import {GenericLayerSpec, NormalizedLayerSpec} from './layer';
import {GenericUnitSpec, NormalizedUnitSpec} from './unit';

export interface RepeatMapping {
  /**
   * An array of fields to be repeated vertically.
   */
  row?: string[];

  /**
   * An array of fields to be repeated horizontally.
   */
  column?: string[];
}

/**
 * Base interface for a repeat specification.
 */
export interface GenericRepeatSpec<U extends GenericUnitSpec<any, any>, L extends GenericLayerSpec<any>>
  extends BaseSpec,
    GenericCompositionLayoutWithColumns,
    ResolveMixins {
  /**
   * Definition for fields to be repeated. One of:
   * 1) An array of fields to be repeated. If `"repeat"` is an array, the field can be referred using `{"repeat": "repeat"}`
   * 2) An object that mapped `"row"` and/or `"column"` to the listed of fields to be repeated along the particular orientations. The objects `{"repeat": "row"}` and `{"repeat": "column"}` can be used to refer to the repeated field respectively.
   */
  repeat: string[] | RepeatMapping;

  /**
   * A specification of the view that gets repeated.
   */
  spec: GenericSpec<U, L>;
}

/**
 * A repeat specification without any shortcut/expansion syntax.
 */
export type NormalizedRepeatSpec = GenericRepeatSpec<NormalizedUnitSpec, NormalizedLayerSpec>;

export function isRepeatSpec(spec: BaseSpec): spec is GenericRepeatSpec<any, any> {
  return spec['repeat'] !== undefined;
}
