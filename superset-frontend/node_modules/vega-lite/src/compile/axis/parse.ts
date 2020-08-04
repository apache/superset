import {AxisEncode as VgAxisEncode, AxisOrient, SignalRef, Text} from 'vega';
import {Axis, AXIS_PARTS, isAxisProperty, isConditionalAxisValue} from '../../axis';
import {isBinned} from '../../bin';
import {PositionScaleChannel, POSITION_SCALE_CHANNELS, X, Y} from '../../channel';
import {FieldDefBase, isTimeFormatFieldDef, toFieldDefBase} from '../../channeldef';
import {contains, getFirstDefined, keys, normalizeAngle} from '../../util';
import {mergeTitle, mergeTitleComponent, mergeTitleFieldDefs, numberFormat} from '../common';
import {guideEncodeEntry} from '../guide';
import {LayerModel} from '../layer';
import {parseGuideResolve} from '../resolve';
import {defaultTieBreaker, Explicit, mergeValuesWithExplicit} from '../split';
import {UnitModel} from '../unit';
import {AxisComponent, AxisComponentIndex, AxisComponentProps, AXIS_COMPONENT_PROPERTIES} from './component';
import {getAxisConfig} from './config';
import * as encode from './encode';
import * as properties from './properties';

export function parseUnitAxes(model: UnitModel): AxisComponentIndex {
  return POSITION_SCALE_CHANNELS.reduce((axis, channel) => {
    if (model.component.scales[channel] && model.axis(channel)) {
      axis[channel] = [parseAxis(channel, model)];
    }
    return axis;
  }, {} as AxisComponentIndex);
}

const OPPOSITE_ORIENT: {[K in AxisOrient]: AxisOrient} = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left'
};

export function parseLayerAxes(model: LayerModel) {
  const {axes, resolve} = model.component;
  const axisCount: {
    // Using Mapped Type to declare type (https://www.typescriptlang.org/docs/handbook/advanced-types.html#mapped-types)
    [k in AxisOrient]: number;
  } = {top: 0, bottom: 0, right: 0, left: 0};

  for (const child of model.children) {
    child.parseAxesAndHeaders();

    for (const channel of keys(child.component.axes)) {
      resolve.axis[channel] = parseGuideResolve(model.component.resolve, channel);
      if (resolve.axis[channel] === 'shared') {
        // If the resolve says shared (and has not been overridden)
        // We will try to merge and see if there is a conflict

        axes[channel] = mergeAxisComponents(axes[channel], child.component.axes[channel]);

        if (!axes[channel]) {
          // If merge returns nothing, there is a conflict so we cannot make the axis shared.
          // Thus, mark axis as independent and remove the axis component.
          resolve.axis[channel] = 'independent';
          delete axes[channel];
        }
      }
    }
  }

  // Move axes to layer's axis component and merge shared axes
  for (const channel of [X, Y]) {
    for (const child of model.children) {
      if (!child.component.axes[channel]) {
        // skip if the child does not have a particular axis
        continue;
      }

      if (resolve.axis[channel] === 'independent') {
        // If axes are independent, concat the axisComponent array.
        axes[channel] = (axes[channel] ?? []).concat(child.component.axes[channel]);

        // Automatically adjust orient
        for (const axisComponent of child.component.axes[channel]) {
          const {value: orient, explicit} = axisComponent.getWithExplicit('orient');
          if (axisCount[orient] > 0 && !explicit) {
            // Change axis orient if the number do not match
            const oppositeOrient = OPPOSITE_ORIENT[orient];
            if (axisCount[orient] > axisCount[oppositeOrient]) {
              axisComponent.set('orient', oppositeOrient, false);
            }
          }
          axisCount[orient]++;

          // TODO(https://github.com/vega/vega-lite/issues/2634): automatically add extra offset?
        }
      }

      // After merging, make sure to remove axes from child
      delete child.component.axes[channel];
    }

    // Suppress grid lines for dual axis charts (https://github.com/vega/vega-lite/issues/4676)
    if (resolve.axis[channel] === 'independent' && axes[channel] && axes[channel].length > 1) {
      for (const axisCmpt of axes[channel]) {
        if (!!axisCmpt.get('grid') && !axisCmpt.explicit.grid) {
          axisCmpt.implicit.grid = false;
        }
      }
    }
  }
}

function mergeAxisComponents(
  mergedAxisCmpts: AxisComponent[],
  childAxisCmpts: readonly AxisComponent[]
): AxisComponent[] {
  if (mergedAxisCmpts) {
    // FIXME: this is a bit wrong once we support multiple axes
    if (mergedAxisCmpts.length !== childAxisCmpts.length) {
      return undefined; // Cannot merge axis component with different number of axes.
    }
    const length = mergedAxisCmpts.length;
    for (let i = 0; i < length; i++) {
      const merged = mergedAxisCmpts[i];
      const child = childAxisCmpts[i];

      if (!!merged !== !!child) {
        return undefined;
      } else if (merged && child) {
        const mergedOrient = merged.getWithExplicit('orient');
        const childOrient = child.getWithExplicit('orient');

        if (mergedOrient.explicit && childOrient.explicit && mergedOrient.value !== childOrient.value) {
          // TODO: throw warning if resolve is explicit (We don't have info about explicit/implicit resolve yet.)

          // Cannot merge due to inconsistent orient
          return undefined;
        } else {
          mergedAxisCmpts[i] = mergeAxisComponent(merged, child);
        }
      }
    }
  } else {
    // For first one, return a copy of the child
    return childAxisCmpts.map(axisComponent => axisComponent.clone());
  }
  return mergedAxisCmpts;
}

function mergeAxisComponent(merged: AxisComponent, child: AxisComponent): AxisComponent {
  for (const prop of AXIS_COMPONENT_PROPERTIES) {
    const mergedValueWithExplicit = mergeValuesWithExplicit<AxisComponentProps, any>(
      merged.getWithExplicit(prop),
      child.getWithExplicit(prop),
      prop,
      'axis',

      // Tie breaker function
      (v1: Explicit<any>, v2: Explicit<any>) => {
        switch (prop) {
          case 'title':
            return mergeTitleComponent(v1, v2);
          case 'gridScale':
            return {
              explicit: v1.explicit, // keep the old explicit
              value: getFirstDefined(v1.value, v2.value)
            };
        }
        return defaultTieBreaker<AxisComponentProps, any>(v1, v2, prop, 'axis');
      }
    );
    merged.setWithExplicit(prop, mergedValueWithExplicit);
  }
  return merged;
}

function getFieldDefTitle(model: UnitModel, channel: 'x' | 'y') {
  const channel2 = channel === 'x' ? 'x2' : 'y2';
  const fieldDef = model.fieldDef(channel);
  const fieldDef2 = model.fieldDef(channel2);

  const title1 = fieldDef ? fieldDef.title : undefined;
  const title2 = fieldDef2 ? fieldDef2.title : undefined;

  if (title1 && title2) {
    return mergeTitle(title1, title2);
  } else if (title1) {
    return title1;
  } else if (title2) {
    return title2;
  } else if (title1 !== undefined) {
    // falsy value to disable config
    return title1;
  } else if (title2 !== undefined) {
    // falsy value to disable config
    return title2;
  }

  return undefined;
}

function isExplicit<T extends string | number | boolean | object>(
  value: T,
  property: keyof AxisComponentProps,
  axis: Axis,
  model: UnitModel,
  channel: PositionScaleChannel
) {
  switch (property) {
    case 'titleAngle':
    case 'labelAngle':
      return value === normalizeAngle(axis[property]);
    case 'values':
      return !!axis.values;
    // specified axis.values is already respected, but may get transformed.
    case 'encode':
      // both VL axis.encoding and axis.labelAngle affect VG axis.encode
      return !!axis.encoding || !!axis.labelAngle;
    case 'title':
      // title can be explicit if fieldDef.title is set
      if (value === getFieldDefTitle(model, channel)) {
        return true;
      }
  }
  // Otherwise, things are explicit if the returned value matches the specified property
  return value === axis[property];
}

function parseAxis(channel: PositionScaleChannel, model: UnitModel): AxisComponent {
  const axis = model.axis(channel);

  const axisComponent = new AxisComponent();

  // 1.2. Add properties
  for (const property of AXIS_COMPONENT_PROPERTIES) {
    const value = getProperty(property, axis, channel, model);
    const configValue = getAxisConfig(
      property,
      model.config,
      channel,
      axisComponent.get('orient'),
      model.getScaleComponent(channel).get('type')
    );

    if (value !== undefined) {
      const explicit = isExplicit(value, property, axis, model, channel);
      // only set property if it is explicitly set or has no config value (otherwise we will accidentally override config)
      if (explicit || configValue === undefined) {
        // Do not apply implicit rule if there is a config value
        axisComponent.set(property, value, explicit);
      } else if (contains(['grid', 'orient'], property) && configValue) {
        // - Grid is an exception because we need to set grid = true to generate another grid axis
        // - Orient is not an axis config in Vega, so we need to set too.
        axisComponent.set(property, configValue, false);
      }
    } else if (
      isConditionalAxisValue<any>(configValue) // need to cast as TS isn't smart enough to figure the generic parameter type yet
    ) {
      // If a config is specified and is conditional, copy conditional value from axis config
      axisComponent.set(property, configValue, false);
    }
  }

  // 2) Add guide encode definition groups
  const axisEncoding = axis.encoding ?? {};
  const axisEncode = AXIS_PARTS.reduce((e: VgAxisEncode, part) => {
    if (!axisComponent.hasAxisPart(part)) {
      // No need to create encode for a disabled part.
      return e;
    }

    const axisEncodingPart = guideEncodeEntry(axisEncoding[part] ?? {}, model);

    const value = part === 'labels' ? encode.labels(model, channel, axisEncodingPart) : axisEncodingPart;

    if (value !== undefined && keys(value).length > 0) {
      e[part] = {update: value};
    }
    return e;
  }, {} as VgAxisEncode);

  // FIXME: By having encode as one property, we won't have fine grained encode merging.
  if (keys(axisEncode).length > 0) {
    axisComponent.set('encode', axisEncode, !!axis.encoding || axis.labelAngle !== undefined);
  }

  return axisComponent;
}

function getProperty<K extends keyof AxisComponentProps>(
  property: K,
  specifiedAxis: Axis,
  channel: PositionScaleChannel,
  model: UnitModel
): AxisComponentProps[K] {
  const fieldDef = model.fieldDef(channel);

  // Some properties depend on labelAngle so we have to declare it here.
  // Also, we don't use `getFirstDefined` for labelAngle
  // as we want to normalize specified value to be within [0,360)
  const labelAngle = properties.labelAngle(model, specifiedAxis, channel, fieldDef);
  const orient = getFirstDefined(specifiedAxis.orient, properties.orient(channel));

  const {mark, config} = model;

  switch (property) {
    case 'scale':
      return model.scaleName(channel) as AxisComponentProps[K];
    case 'gridScale':
      return properties.gridScale(model, channel) as AxisComponentProps[K];
    case 'format':
      // We don't include temporal field here as we apply format in encode block
      if (isTimeFormatFieldDef(fieldDef)) {
        return undefined;
      }
      return numberFormat(fieldDef, specifiedAxis.format, config) as AxisComponentProps[K];
    case 'formatType':
      // As with format, we don't include temporal field here as we apply format in encode block
      if (isTimeFormatFieldDef(fieldDef)) {
        return undefined;
      }
      return specifiedAxis.formatType as AxisComponentProps[K];
    case 'grid': {
      if (isBinned(model.fieldDef(channel).bin)) {
        return false as AxisComponentProps[K];
      } else {
        const scaleType = model.getScaleComponent(channel).get('type');
        return getFirstDefined(
          specifiedAxis.grid,
          properties.defaultGrid(scaleType, fieldDef)
        ) as AxisComponentProps[K];
      }
    }
    case 'labelAlign':
      return getFirstDefined(
        specifiedAxis.labelAlign,
        properties.defaultLabelAlign(labelAngle, orient)
      ) as AxisComponentProps[K];
    case 'labelAngle':
      return labelAngle as AxisComponentProps[K];
    case 'labelBaseline':
      return getFirstDefined(
        specifiedAxis.labelBaseline,
        properties.defaultLabelBaseline(labelAngle, orient)
      ) as AxisComponentProps[K];
    case 'labelFlush':
      return getFirstDefined(
        specifiedAxis.labelFlush,
        properties.defaultLabelFlush(fieldDef, channel)
      ) as AxisComponentProps[K];
    case 'labelOverlap': {
      const scaleType = model.getScaleComponent(channel).get('type');
      return getFirstDefined(
        specifiedAxis.labelOverlap,
        properties.defaultLabelOverlap(fieldDef, scaleType)
      ) as AxisComponentProps[K];
    }
    case 'orient':
      return orient as AxisComponentProps[K];
    case 'tickCount': {
      const scaleType = model.getScaleComponent(channel).get('type');
      const sizeType = channel === 'x' ? 'width' : channel === 'y' ? 'height' : undefined;
      const size = sizeType ? model.getSizeSignalRef(sizeType) : undefined;
      return getFirstDefined<number | SignalRef>(
        specifiedAxis.tickCount,
        properties.defaultTickCount({fieldDef, scaleType, size})
      ) as AxisComponentProps[K];
    }
    case 'title': {
      const channel2 = channel === 'x' ? 'x2' : 'y2';
      const fieldDef2 = model.fieldDef(channel2);
      // Keep undefined so we use default if title is unspecified.
      // For other falsy value, keep them so we will hide the title.
      return getFirstDefined<Text | FieldDefBase<string>[]>(
        specifiedAxis.title,
        getFieldDefTitle(model, channel), // If title not specified, store base parts of fieldDef (and fieldDef2 if exists)
        mergeTitleFieldDefs([toFieldDefBase(fieldDef)], fieldDef2 ? [toFieldDefBase(fieldDef2)] : [])
      ) as AxisComponentProps[K];
    }
    case 'values':
      return properties.values(specifiedAxis, model, fieldDef) as AxisComponentProps[K];
    case 'zindex':
      return getFirstDefined(specifiedAxis.zindex, properties.defaultZindex(mark, fieldDef)) as AxisComponentProps[K];
  }
  // Otherwise, return specified property.
  return isAxisProperty(property) ? (specifiedAxis[property] as AxisComponentProps[K]) : undefined;
}
