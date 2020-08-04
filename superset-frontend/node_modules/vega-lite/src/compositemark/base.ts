import {GenericMarkDef, getMarkType} from '../mark';
import {NonFacetUnitNormalizer, Normalize, NormalizerParams} from '../normalize/base';
import {GenericSpec} from '../spec';
import {GenericLayerSpec, NormalizedLayerSpec} from '../spec/layer';
import {GenericUnitSpec, isUnitSpec, NormalizedUnitSpec} from '../spec/unit';

export type CompositeMarkUnitSpec<M extends string> = GenericUnitSpec<any, M | GenericMarkDef<M>>;

export class CompositeMarkNormalizer<M extends string> implements NonFacetUnitNormalizer<CompositeMarkUnitSpec<M>> {
  constructor(
    public name: string,
    public run: (
      spec: CompositeMarkUnitSpec<M>,
      params: NormalizerParams,
      normalize: Normalize<
        // Input of the normalize method
        GenericUnitSpec<any, any> | GenericLayerSpec<any>,
        // Output of the normalize method
        NormalizedLayerSpec | NormalizedUnitSpec
      >
    ) => NormalizedLayerSpec
  ) {}

  public hasMatchingType(spec: GenericSpec<any, any>): spec is CompositeMarkUnitSpec<M> {
    if (isUnitSpec(spec)) {
      return getMarkType(spec.mark) === this.name;
    }
    return false;
  }
}
