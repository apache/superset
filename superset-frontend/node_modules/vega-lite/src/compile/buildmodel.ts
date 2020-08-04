import {Config} from '../config';
import * as log from '../log';
import {
  isAnyConcatSpec,
  isFacetSpec,
  isLayerSpec,
  isRepeatSpec,
  isUnitSpec,
  LayoutSizeMixins,
  NormalizedSpec
} from '../spec';
import {ConcatModel} from './concat';
import {FacetModel} from './facet';
import {LayerModel} from './layer';
import {Model} from './model';
import {RepeatModel} from './repeat';
import {RepeaterValue} from './repeater';
import {UnitModel} from './unit';

export function buildModel(
  spec: NormalizedSpec,
  parent: Model,
  parentGivenName: string,
  unitSize: LayoutSizeMixins,
  repeater: RepeaterValue,
  config: Config
): Model {
  if (isFacetSpec(spec)) {
    return new FacetModel(spec, parent, parentGivenName, repeater, config);
  } else if (isLayerSpec(spec)) {
    return new LayerModel(spec, parent, parentGivenName, unitSize, repeater, config);
  } else if (isUnitSpec(spec)) {
    return new UnitModel(spec, parent, parentGivenName, unitSize, repeater, config);
  } else if (isRepeatSpec(spec)) {
    return new RepeatModel(spec, parent, parentGivenName, repeater, config);
  } else if (isAnyConcatSpec(spec)) {
    return new ConcatModel(spec, parent, parentGivenName, repeater, config);
  }
  throw new Error(log.message.invalidSpec(spec));
}
