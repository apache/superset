import {CompositeEncoding} from '../compositemark';
import {Projection} from '../projection';
import {BaseSpec, FrameMixins, ResolveMixins} from './base';
import {GenericUnitSpec, NormalizedUnitSpec, UnitSpec} from './unit';

/**
 * Base interface for a layer specification.
 */
export interface GenericLayerSpec<U extends GenericUnitSpec<any, any>> extends BaseSpec, FrameMixins, ResolveMixins {
  /**
   * Layer or single view specifications to be layered.
   *
   * __Note__: Specifications inside `layer` cannot use `row` and `column` channels as layering facet specifications is not allowed. Instead, use the [facet operator](https://vega.github.io/vega-lite/docs/facet.html) and place a layer inside a facet.
   */
  layer: (GenericLayerSpec<U> | U)[];
}

/**
 * A full layered plot specification, which may contains `encoding` and `projection` properties that will be applied to underlying unit (single-view) specifications.
 */
export interface LayerSpec extends GenericLayerSpec<UnitSpec> {
  /**
   * A shared key-value mapping between encoding channels and definition of fields in the underlying layers.
   */
  encoding?: CompositeEncoding;

  /**
   * An object defining properties of the geographic projection shared by underlying layers.
   */
  projection?: Projection;
}

/**
 * A layered specification without any shortcut/expansion syntax.
 */
export type NormalizedLayerSpec = GenericLayerSpec<NormalizedUnitSpec>;

export function isLayerSpec(spec: BaseSpec): spec is GenericLayerSpec<any> {
  return spec['layer'] !== undefined;
}
