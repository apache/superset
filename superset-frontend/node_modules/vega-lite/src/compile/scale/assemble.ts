import {Channel, ScaleChannel} from '../../channel';
import {keys} from '../../util';
import {isVgRangeStep, VgRange, VgScale} from '../../vega.schema';
import {isConcatModel, isLayerModel, isRepeatModel, Model} from '../model';
import {assembleSelectionScaleDomain} from '../selection/assemble';
import {assembleDomain} from './domain';

export function assembleScales(model: Model): VgScale[] {
  if (isLayerModel(model) || isConcatModel(model) || isRepeatModel(model)) {
    // For concat / layer / repeat, include scales of children too
    return model.children.reduce((scales, child) => {
      return scales.concat(assembleScales(child));
    }, assembleScalesForModel(model));
  } else {
    // For facet, child scales would not be included in the parent's scope.
    // For unit, there is no child.
    return assembleScalesForModel(model);
  }
}

export function assembleScalesForModel(model: Model): VgScale[] {
  return keys(model.component.scales).reduce((scales: VgScale[], channel: ScaleChannel) => {
    const scaleComponent = model.component.scales[channel];
    if (scaleComponent.merged) {
      // Skipped merged scales
      return scales;
    }

    const scale = scaleComponent.combine();
    const {name, type, selectionExtent, domains: _d, range: _r, ...otherScaleProps} = scale;
    const range = assembleScaleRange(scale.range, name, channel);

    let domainRaw;
    if (selectionExtent) {
      domainRaw = assembleSelectionScaleDomain(model, selectionExtent);
    }

    const domain = assembleDomain(model, channel);

    scales.push({
      name,
      type,
      ...(domain ? {domain} : {}),
      ...(domainRaw ? {domainRaw} : {}),
      range: range,
      ...otherScaleProps
    });

    return scales;
  }, [] as VgScale[]);
}

export function assembleScaleRange(scaleRange: VgRange, scaleName: string, channel: Channel): VgRange {
  // add signals to x/y range
  if (channel === 'x' || channel === 'y') {
    if (isVgRangeStep(scaleRange)) {
      // For width/height step, use a signal created in layout assemble instead of a constant step.
      return {
        step: {signal: scaleName + '_step'}
      };
    }
  }
  return scaleRange;
}
