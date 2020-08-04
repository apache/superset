import {Config} from '../config';
import {Encoding} from '../encoding';
import {Projection} from '../projection';
import {GenericSpec, NormalizedSpec} from '../spec';
import {GenericLayerSpec, NormalizedLayerSpec} from '../spec/layer';
import {GenericUnitSpec, NormalizedUnitSpec} from '../spec/unit';

export type Normalize<S extends GenericSpec<any, any>, NS extends NormalizedSpec> = (
  spec: S,
  params: NormalizerParams
) => NS;

export interface ExtraNormalizer<
  S extends GenericSpec<any, any>, // Input type
  O extends NormalizedSpec, // Output Type
  SN extends GenericSpec<any, any> = S // input to additional normalization
> {
  name: string;
  hasMatchingType: (spec: GenericSpec<any, any>, config: Config) => spec is S;

  run(spec: S, params: NormalizerParams, normalize: Normalize<SN, O>): O;
}

export type NonFacetUnitNormalizer<S extends GenericUnitSpec<any, any>> = ExtraNormalizer<
  S,
  NormalizedUnitSpec | NormalizedLayerSpec,
  GenericUnitSpec<any, any> | GenericLayerSpec<any>
>;

export type NormalizeLayerOrUnit = Normalize<
  GenericUnitSpec<any, any> | GenericLayerSpec<any>,
  NormalizedUnitSpec | NormalizedLayerSpec
>;

export interface NormalizerParams {
  config: Config;
  parentEncoding?: Encoding<any>;
  parentProjection?: Projection;
}
