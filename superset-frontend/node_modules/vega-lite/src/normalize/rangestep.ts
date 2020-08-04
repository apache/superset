import {getSizeType, POSITION_SCALE_CHANNELS} from '../channel';
import {isFieldDef} from '../channeldef';
import {Encoding} from '../encoding';
import * as log from '../log';
import {Scale} from '../scale';
import {GenericSpec} from '../spec';
import {GenericUnitSpec, isUnitSpec, NormalizedUnitSpec} from '../spec/unit';
import {keys} from '../util';
import {NonFacetUnitNormalizer} from './base';

type UnitSpecWithRangeStep = GenericUnitSpec<Encoding<string>, any>; // this is not accurate, but it's not worth making it accurate

export class RangeStepNormalizer implements NonFacetUnitNormalizer<UnitSpecWithRangeStep> {
  public name = 'RangeStep';

  public hasMatchingType(spec: GenericSpec<any, any>): spec is UnitSpecWithRangeStep {
    if (isUnitSpec(spec) && spec.encoding) {
      for (const channel of POSITION_SCALE_CHANNELS) {
        const def = spec.encoding[channel];
        if (def && isFieldDef(def)) {
          if (def?.scale?.['rangeStep']) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public run(spec: UnitSpecWithRangeStep): NormalizedUnitSpec {
    const sizeMixins = {};
    let encoding = {...spec.encoding};

    for (const channel of POSITION_SCALE_CHANNELS) {
      const sizeType = getSizeType(channel);
      const def = encoding[channel];
      if (def && isFieldDef(def)) {
        if (def?.scale?.['rangeStep']) {
          const {scale, ...defWithoutScale} = def;

          const {rangeStep, ...scaleWithoutRangeStep} = scale as Scale & {rangeStep: number};
          sizeMixins[sizeType] = {step: scale['rangeStep']};

          log.warn(log.message.RANGE_STEP_DEPRECATED);

          encoding = {
            ...encoding,
            [channel]: {
              ...defWithoutScale,
              ...(keys(scaleWithoutRangeStep).length > 0 ? {scale: scaleWithoutRangeStep} : {})
            }
          };
        }
      }
    }
    return {
      ...sizeMixins,
      ...spec,
      encoding
    };
  }
}
