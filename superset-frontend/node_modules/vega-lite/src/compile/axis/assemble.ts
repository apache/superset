import {Axis as VgAxis, AxisEncode, NewSignal, SignalRef, Text} from 'vega';
import {stringValue, array} from 'vega-util';
import {AXIS_PARTS, AXIS_PROPERTY_TYPE, CONDITIONAL_AXIS_PROP_INDEX, isConditionalAxisValue} from '../../axis';
import {POSITION_SCALE_CHANNELS} from '../../channel';
import {defaultTitle, FieldDefBase} from '../../channeldef';
import {Config} from '../../config';
import {isText} from '../../title';
import {getFirstDefined, keys, replaceAll} from '../../util';
import {isSignalRef, VgEncodeChannel, VgValueRef} from '../../vega.schema';
import {Model} from '../model';
import {expression} from '../predicate';
import {AxisComponent, AxisComponentIndex} from './component';

function assembleTitle(title: Text | FieldDefBase<string>[], config: Config): Text {
  if (!title) {
    return undefined;
  }
  if (!isText(title)) {
    return title.map(fieldDef => defaultTitle(fieldDef, config)).join(', ');
  }
  return title;
}

function setAxisEncode(
  axis: Omit<VgAxis, 'orient' | 'scale'>,
  part: keyof AxisEncode,
  vgProp: VgEncodeChannel,
  vgRef: VgValueRef | readonly VgValueRef[]
) {
  axis.encode = axis.encode ?? {};
  axis.encode[part] = axis.encode[part] ?? {};
  axis.encode[part].update = axis.encode[part].update ?? {};
  // TODO: remove as any after https://github.com/prisma/nexus-prisma/issues/291
  (axis.encode[part].update[vgProp] as any) = vgRef;
}

export function assembleAxis(
  axisCmpt: AxisComponent,
  kind: 'main' | 'grid',
  config: Config,
  opt: {
    header: boolean; // whether this is called via a header
  } = {header: false}
): VgAxis {
  const {orient, scale, labelExpr, title, zindex, ...axis} = axisCmpt.combine();

  for (const prop in axis) {
    const propType = AXIS_PROPERTY_TYPE[prop];
    const propValue = axis[prop];

    if (propType && propType !== kind && propType !== 'both') {
      // Remove properties that are not valid for this kind of axis
      delete axis[prop];
    } else if (isConditionalAxisValue(propValue)) {
      // deal with conditional axis value

      const {condition, value} = propValue;
      const conditions = array(condition);

      const propIndex = CONDITIONAL_AXIS_PROP_INDEX[prop];
      if (propIndex) {
        const {vgProp, part} = propIndex;
        // If there is a corresponding Vega property for the channel,
        // use Vega's custom axis encoding and delete the original axis property to avoid conflicts

        const vgRef = [
          ...conditions.map(c => {
            const {value: v, test} = c;
            return {
              test: expression(null, test),
              value: v
            };
          }),
          {value}
        ];
        setAxisEncode(axis, part, vgProp, vgRef);
        delete axis[prop];
      } else if (propIndex === null) {
        // If propIndex is null, this means we support conditional axis property by converting the condition to signal insteed.
        const signalRef: SignalRef = {
          signal:
            conditions
              .map(c => {
                const {value: v, test} = c;
                return `${expression(null, test)} ? ${stringValue(v)} : `;
              })
              .join('') + stringValue(value)
        };
        axis[prop] = signalRef;
      }
    }
  }

  if (kind === 'grid') {
    if (!axis.grid) {
      return undefined;
    }

    // Remove unnecessary encode block
    if (axis.encode) {
      // Only need to keep encode block for grid
      const {grid} = axis.encode;
      axis.encode = {
        ...(grid ? {grid} : {})
      };

      if (keys(axis.encode).length === 0) {
        delete axis.encode;
      }
    }

    return {
      scale,
      orient,
      ...axis,
      domain: false,
      labels: false,

      // Always set min/maxExtent to 0 to ensure that `config.axis*.minExtent` and `config.axis*.maxExtent`
      // would not affect gridAxis
      maxExtent: 0,
      minExtent: 0,
      ticks: false,
      zindex: getFirstDefined(zindex, 0) // put grid behind marks by default
    };
  } else {
    // kind === 'main'

    if (!opt.header && axisCmpt.mainExtracted) {
      // if mainExtracted has been extracted to a separate facet
      return undefined;
    }

    if (labelExpr !== undefined) {
      let expr = labelExpr;
      if (axis.encode?.labels?.update && isSignalRef(axis.encode.labels.update.text)) {
        expr = replaceAll(labelExpr, 'datum.label', axis.encode.labels.update.text.signal);
      }

      setAxisEncode(axis, 'labels', 'text', {signal: expr});
    }

    // Remove unnecessary encode block
    if (axis.encode) {
      for (const part of AXIS_PARTS) {
        if (!axisCmpt.hasAxisPart(part)) {
          delete axis.encode[part];
        }
      }
      if (keys(axis.encode).length === 0) {
        delete axis.encode;
      }
    }

    const titleString = assembleTitle(title, config);

    return {
      scale,
      orient,
      grid: false,
      ...(titleString ? {title: titleString} : {}),
      ...axis,
      zindex: getFirstDefined(zindex, 0) // put axis line above marks by default
    };
  }
}

/**
 * Add axis signals so grid line works correctly
 * (Fix https://github.com/vega/vega-lite/issues/4226)
 */
export function assembleAxisSignals(model: Model): NewSignal[] {
  const {axes} = model.component;
  for (const channel of POSITION_SCALE_CHANNELS) {
    if (axes[channel]) {
      for (const axis of axes[channel]) {
        if (!axis.get('gridScale')) {
          // If there is x-axis but no y-scale for gridScale, need to set height/weight so x-axis can draw the grid with the right height. Same for y-axis and width.

          const sizeType = channel === 'x' ? 'height' : 'width';
          return [
            {
              name: sizeType,
              update: model.getSizeSignalRef(sizeType).signal
            }
          ];
        }
      }
    }
  }
  return [];
}

export function assembleAxes(axisComponents: AxisComponentIndex, config: Config): VgAxis[] {
  const {x = [], y = []} = axisComponents;
  return [
    ...x.map(a => assembleAxis(a, 'grid', config)),
    ...y.map(a => assembleAxis(a, 'grid', config)),
    ...x.map(a => assembleAxis(a, 'main', config)),
    ...y.map(a => assembleAxis(a, 'main', config))
  ].filter(a => a); // filter undefined
}
