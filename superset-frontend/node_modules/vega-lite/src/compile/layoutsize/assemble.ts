import {NewSignal, InitSignal} from 'vega';
import {hasDiscreteDomain} from '../../scale';
import {getFirstDefined} from '../../util';
import {isVgRangeStep, VgRangeStep} from '../../vega.schema';
import {isFacetModel, Model} from '../model';
import {ScaleComponent} from '../scale/component';
import {getViewConfigContinuousSize} from '../../config';

export function assembleLayoutSignals(model: Model): NewSignal[] {
  return [...sizeSignals(model, 'width'), ...sizeSignals(model, 'height')];
}

export function sizeSignals(model: Model, sizeType: 'width' | 'height'): (NewSignal | InitSignal)[] {
  const channel = sizeType === 'width' ? 'x' : 'y';
  const size = model.component.layoutSize.get(sizeType);
  if (!size || size === 'merged') {
    return [];
  }

  // Read size signal name from name map, just in case it is the top-level size signal that got renamed.
  const name = model.getSizeSignalRef(sizeType).signal;

  if (size === 'step') {
    const scaleComponent = model.getScaleComponent(channel);

    if (scaleComponent) {
      const type = scaleComponent.get('type');
      const range = scaleComponent.get('range');

      if (hasDiscreteDomain(type) && isVgRangeStep(range)) {
        const scaleName = model.scaleName(channel);

        if (isFacetModel(model.parent)) {
          // If parent is facet and this is an independent scale, return only signal signal
          // as the width/height will be calculated using the cardinality from
          // facet's aggregate rather than reading from scale domain
          const parentResolve = model.parent.component.resolve;
          if (parentResolve.scale[channel] === 'independent') {
            return [stepSignal(scaleName, range)];
          }
        }

        return [
          stepSignal(scaleName, range),
          {
            name,
            update: sizeExpr(scaleName, scaleComponent, `domain('${scaleName}').length`)
          }
        ];
      }
    }
    /* istanbul ignore next: Condition should not happen -- only for warning in development. */
    throw new Error('layout size is step although width/height is not step.');
  } else if (size == 'container') {
    const isWidth = name.endsWith('width');
    const expr = isWidth ? 'containerSize()[0]' : 'containerSize()[1]';
    const defaultValue = getViewConfigContinuousSize(model.config.view, isWidth ? 'width' : 'height');
    const safeExpr = `isFinite(${expr}) ? ${expr} : ${defaultValue}`;
    return [{name, init: safeExpr, on: [{update: safeExpr, events: 'window:resize'}]}];
  } else {
    return [
      {
        name,
        value: size
      }
    ];
  }
}

function stepSignal(scaleName: string, range: VgRangeStep): NewSignal {
  return {
    name: scaleName + '_step',
    value: range.step
  };
}

export function sizeExpr(scaleName: string, scaleComponent: ScaleComponent, cardinality: string) {
  const type = scaleComponent.get('type');
  const padding = scaleComponent.get('padding');
  const paddingOuter = getFirstDefined(scaleComponent.get('paddingOuter'), padding);

  let paddingInner = scaleComponent.get('paddingInner');
  paddingInner =
    type === 'band'
      ? // only band has real paddingInner
        paddingInner !== undefined
        ? paddingInner
        : padding
      : // For point, as calculated in https://github.com/vega/vega-scale/blob/master/src/band.js#L128,
        // it's equivalent to have paddingInner = 1 since there is only n-1 steps between n points.
        1;
  return `bandspace(${cardinality}, ${paddingInner}, ${paddingOuter}) * ${scaleName}_step`;
}
