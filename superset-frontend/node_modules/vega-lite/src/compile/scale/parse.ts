import {ScaleChannel, SCALE_CHANNELS, SHAPE} from '../../channel';
import {hasConditionalFieldDef, isFieldDef, TypedFieldDef} from '../../channeldef';
import {GEOSHAPE} from '../../mark';
import {
  NON_TYPE_DOMAIN_RANGE_VEGA_SCALE_PROPERTIES,
  Scale,
  scaleCompatible,
  ScaleType,
  scaleTypePrecedence
} from '../../scale';
import {GEOJSON} from '../../type';
import {keys} from '../../util';
import {VgScale} from '../../vega.schema';
import {isUnitModel, Model} from '../model';
import {defaultScaleResolve} from '../resolve';
import {Explicit, mergeValuesWithExplicit, tieBreakByComparing} from '../split';
import {UnitModel} from '../unit';
import {ScaleComponent, ScaleComponentIndex} from './component';
import {parseScaleDomain} from './domain';
import {parseScaleProperty, parseScaleRange} from './properties';
import {scaleType} from './type';

export function parseScales(model: Model, {ignoreRange}: {ignoreRange?: boolean} = {}) {
  parseScaleCore(model);
  parseScaleDomain(model);
  for (const prop of NON_TYPE_DOMAIN_RANGE_VEGA_SCALE_PROPERTIES) {
    parseScaleProperty(model, prop);
  }
  if (!ignoreRange) {
    // range depends on zero
    parseScaleRange(model);
  }
}

export function parseScaleCore(model: Model) {
  if (isUnitModel(model)) {
    model.component.scales = parseUnitScaleCore(model);
  } else {
    model.component.scales = parseNonUnitScaleCore(model);
  }
}

/**
 * Parse scales for all channels of a model.
 */
function parseUnitScaleCore(model: UnitModel): ScaleComponentIndex {
  const {encoding, mark} = model;

  return SCALE_CHANNELS.reduce((scaleComponents: ScaleComponentIndex, channel: ScaleChannel) => {
    let fieldDef: TypedFieldDef<string>;
    let specifiedScale: Scale | null;

    const channelDef = encoding[channel];

    // Don't generate scale for shape of geoshape
    if (isFieldDef(channelDef) && mark === GEOSHAPE && channel === SHAPE && channelDef.type === GEOJSON) {
      return scaleComponents;
    }

    if (isFieldDef(channelDef)) {
      fieldDef = channelDef;
      specifiedScale = channelDef.scale;
    } else if (hasConditionalFieldDef<string, any>(channelDef)) {
      // Need to specify generic for hasConditionalFieldDef as the value type can vary across channels
      fieldDef = channelDef.condition;
      specifiedScale = channelDef.condition['scale']; // We use ['scale'] since we know that channel here has scale for sure
    }

    if (fieldDef && specifiedScale !== null && specifiedScale !== false) {
      specifiedScale = specifiedScale ?? {};

      const sType = scaleType(specifiedScale, channel, fieldDef, mark);
      scaleComponents[channel] = new ScaleComponent(model.scaleName(channel + '', true), {
        value: sType,
        explicit: specifiedScale.type === sType
      });
    }

    return scaleComponents;
  }, {});
}

const scaleTypeTieBreaker = tieBreakByComparing(
  (st1: ScaleType, st2: ScaleType) => scaleTypePrecedence(st1) - scaleTypePrecedence(st2)
);

function parseNonUnitScaleCore(model: Model) {
  const scaleComponents: ScaleComponentIndex = (model.component.scales = {});

  const scaleTypeWithExplicitIndex: {
    // Using Mapped Type to declare type (https://www.typescriptlang.org/docs/handbook/advanced-types.html#mapped-types)
    [k in ScaleChannel]?: Explicit<ScaleType>;
  } = {};
  const resolve = model.component.resolve;

  // Parse each child scale and determine if a particular channel can be merged.
  for (const child of model.children) {
    parseScaleCore(child);

    // Instead of always merging right away -- check if it is compatible to merge first!
    keys(child.component.scales).forEach((channel: ScaleChannel) => {
      // if resolve is undefined, set default first
      resolve.scale[channel] = resolve.scale[channel] ?? defaultScaleResolve(channel, model);

      if (resolve.scale[channel] === 'shared') {
        const explicitScaleType = scaleTypeWithExplicitIndex[channel];
        const childScaleType = child.component.scales[channel].getWithExplicit('type');

        if (explicitScaleType) {
          if (scaleCompatible(explicitScaleType.value, childScaleType.value)) {
            // merge scale component if type are compatible
            scaleTypeWithExplicitIndex[channel] = mergeValuesWithExplicit<VgScale, ScaleType>(
              explicitScaleType,
              childScaleType,
              'type',
              'scale',
              scaleTypeTieBreaker
            );
          } else {
            // Otherwise, update conflicting channel to be independent
            resolve.scale[channel] = 'independent';
            // Remove from the index so they don't get merged
            delete scaleTypeWithExplicitIndex[channel];
          }
        } else {
          scaleTypeWithExplicitIndex[channel] = childScaleType;
        }
      }
    });
  }

  // Merge each channel listed in the index
  for (const channel of keys(scaleTypeWithExplicitIndex)) {
    // Create new merged scale component
    const name = model.scaleName(channel, true);
    const typeWithExplicit = scaleTypeWithExplicitIndex[channel];
    scaleComponents[channel] = new ScaleComponent(name, typeWithExplicit);

    // rename each child and mark them as merged
    for (const child of model.children) {
      const childScale = child.component.scales[channel];
      if (childScale) {
        child.renameScale(childScale.get('name'), name);
        childScale.merged = true;
      }
    }
  }

  return scaleComponents;
}
