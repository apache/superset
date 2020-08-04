import {Config} from './config';
import {extractTransformsFromEncoding} from './encoding';
import {NormalizedSpec} from './spec';
import {SpecMapper} from './spec/map';
import {GenericUnitSpec} from './spec/unit';

class TransformExtractMapper extends SpecMapper<{config: Config}, GenericUnitSpec<any, any>> {
  public mapUnit(spec: GenericUnitSpec<any, any>, {config}: {config: Config}) {
    if (spec.encoding) {
      const {encoding: oldEncoding, transform: oldTransforms} = spec;
      const {bins, timeUnits, aggregate, groupby, encoding} = extractTransformsFromEncoding(oldEncoding, config);

      const transform = [
        ...(oldTransforms ? oldTransforms : []),
        ...bins,
        ...timeUnits,
        ...(aggregate.length === 0 ? [] : [{aggregate, groupby}])
      ];

      return {
        ...spec,
        ...(transform.length > 0 ? {transform} : {}),
        encoding
      };
    } else {
      return spec;
    }
  }
}

const extractor = new TransformExtractMapper();

/**
 * Modifies spec extracting transformations from encoding and moving them to the transforms array
 */
export function extractTransforms(spec: NormalizedSpec, config: Config): NormalizedSpec {
  return extractor.map(spec, {config});
}
