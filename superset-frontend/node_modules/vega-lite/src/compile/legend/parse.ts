import {Legend as VgLegend, LegendEncode, SignalRef} from 'vega';
import {
  COLOR,
  FILL,
  FILLOPACITY,
  NonPositionScaleChannel,
  OPACITY,
  SHAPE,
  SIZE,
  STROKE,
  STROKEOPACITY,
  STROKEWIDTH
} from '../../channel';
import {
  getTypedFieldDef,
  isFieldDef,
  isTimeFormatFieldDef,
  title as fieldDefTitle,
  TypedFieldDef
} from '../../channeldef';
import {Legend} from '../../legend';
import {GEOJSON} from '../../type';
import {deleteNestedProperty, getFirstDefined, keys, varName} from '../../util';
import {mergeTitleComponent, numberFormat} from '../common';
import {guideEncodeEntry} from '../guide';
import {isUnitModel, Model} from '../model';
import {parseGuideResolve} from '../resolve';
import {defaultTieBreaker, Explicit, makeImplicit, mergeValuesWithExplicit} from '../split';
import {UnitModel} from '../unit';
import {LegendComponent, LegendComponentIndex, LegendComponentProps, LEGEND_COMPONENT_PROPERTIES} from './component';
import * as encode from './encode';
import * as properties from './properties';
import {direction, type} from './properties';
import {parseInteractiveLegend} from '../selection/transforms/legends';
import {normalizeTimeUnit} from '../../timeunit';

export function parseLegend(model: Model) {
  if (isUnitModel(model)) {
    model.component.legends = parseUnitLegend(model);
  } else {
    model.component.legends = parseNonUnitLegend(model);
  }
}

function parseUnitLegend(model: UnitModel): LegendComponentIndex {
  const {encoding} = model;
  return [COLOR, FILL, STROKE, STROKEWIDTH, SIZE, SHAPE, OPACITY, FILLOPACITY, STROKEOPACITY].reduce(
    (legendComponent, channel) => {
      const def = encoding[channel];
      if (
        model.legend(channel) &&
        model.getScaleComponent(channel) &&
        !(isFieldDef(def) && channel === SHAPE && def.type === GEOJSON)
      ) {
        legendComponent[channel] = parseLegendForChannel(model, channel);
      }
      return legendComponent;
    },
    {}
  );
}

function getLegendDefWithScale(model: UnitModel, channel: NonPositionScaleChannel): VgLegend {
  const scale = model.scaleName(COLOR);
  if (channel === 'color') {
    return model.markDef.filled ? {fill: scale} : {stroke: scale};
  }
  return {[channel]: model.scaleName(channel)};
}

function isExplicit<T extends string | number | object | boolean>(
  value: T,
  property: keyof LegendComponentProps,
  legend: Legend,
  fieldDef: TypedFieldDef<string>
) {
  switch (property) {
    case 'values':
      // specified legend.values is already respected, but may get transformed.
      return !!legend.values;
    case 'title':
      // title can be explicit if fieldDef.title is set
      if (property === 'title' && value === fieldDef.title) {
        return true;
      }
  }
  // Otherwise, things are explicit if the returned value matches the specified property
  return value === legend[property];
}

export function parseLegendForChannel(model: UnitModel, channel: NonPositionScaleChannel): LegendComponent {
  const fieldDef = model.fieldDef(channel);
  const legend = model.legend(channel);

  const legendCmpt = new LegendComponent({}, getLegendDefWithScale(model, channel));
  parseInteractiveLegend(model, channel, legendCmpt);

  for (const property of LEGEND_COMPONENT_PROPERTIES) {
    const value = getProperty(property, legend, channel, model);
    if (value !== undefined) {
      const explicit = isExplicit(value, property, legend, fieldDef);
      if (explicit || model.config.legend[property] === undefined) {
        legendCmpt.set(property, value, explicit);
      }
    }
  }

  const legendEncoding = legend.encoding ?? {};
  const selections = legendCmpt.get('selections');
  const legendEncode = (['labels', 'legend', 'title', 'symbols', 'gradient', 'entries'] as const).reduce(
    (e: LegendEncode, part) => {
      const legendEncodingPart = guideEncodeEntry(legendEncoding[part] ?? {}, model);
      const value = encode[part]
        ? encode[part](fieldDef, legendEncodingPart, model, channel, legendCmpt) // apply rule
        : legendEncodingPart; // no rule -- just default values
      if (value !== undefined && keys(value).length > 0) {
        e[part] = {
          ...(selections?.length ? {name: `${varName(fieldDef.field)}_legend_${part}`} : {}),
          ...(selections?.length ? {interactive: !!selections} : {}),
          update: value
        };
      }
      return e;
    },
    {} as LegendEncode
  );

  if (keys(legendEncode).length > 0) {
    legendCmpt.set('encode', legendEncode, !!legend.encoding);
  }

  return legendCmpt;
}

function getProperty<K extends keyof LegendComponentProps>(
  property: K,
  legend: Legend,
  channel: NonPositionScaleChannel,
  model: UnitModel
): LegendComponentProps[K] {
  const {encoding, mark} = model;
  const fieldDef = getTypedFieldDef(encoding[channel]);
  const legendConfig = model.config.legend;
  const timeUnit = normalizeTimeUnit(fieldDef.timeUnit)?.unit;

  const scaleType = model.getScaleComponent(channel).get('type');

  switch (property) {
    // TODO: enable when https://github.com/vega/vega/issues/1351 is fixed
    // case 'clipHeight':
    //   return getFirstDefined(specifiedLegend.clipHeight, properties.clipHeight(properties.type(...)));

    case 'direction':
      return direction({
        legend,
        legendConfig,
        timeUnit,
        channel,
        scaleType
      }) as LegendComponentProps[K];

    case 'format':
      // We don't include temporal field here as we apply format in encode block
      if (isTimeFormatFieldDef(fieldDef)) {
        return undefined;
      }
      return numberFormat(fieldDef, legend.format, model.config) as LegendComponentProps[K];

    case 'formatType':
      // As with format, we don't include temporal field here as we apply format in encode block
      if (isTimeFormatFieldDef(fieldDef)) {
        return undefined;
      }
      return legend.formatType as LegendComponentProps[K];

    case 'gradientLength':
      return getFirstDefined<number | SignalRef>(
        // do specified gradientLength first
        legend.gradientLength,
        legendConfig.gradientLength,
        // Otherwise, use smart default based on plot height
        properties.defaultGradientLength({
          model,
          legend,
          legendConfig,
          channel,
          scaleType
        })
      ) as LegendComponentProps[K];

    case 'labelOverlap':
      return getFirstDefined(legend.labelOverlap, properties.defaultLabelOverlap(scaleType)) as LegendComponentProps[K];

    case 'symbolType':
      return getFirstDefined(
        legend.symbolType,
        properties.defaultSymbolType(mark, channel, encoding.shape, model.markDef.shape)
      ) as LegendComponentProps[K];

    case 'title':
      return (fieldDefTitle(fieldDef, model.config, {allowDisabling: true}) || undefined) as LegendComponentProps[K];

    case 'type':
      return type({legend, channel, timeUnit, scaleType, alwaysReturn: false}) as LegendComponentProps[K];

    case 'values':
      return properties.values(legend, fieldDef) as LegendComponentProps[K];
  }

  // Otherwise, return specified property.
  return (legend as LegendComponentProps)[property];
}

function parseNonUnitLegend(model: Model) {
  const {legends, resolve} = model.component;

  for (const child of model.children) {
    parseLegend(child);

    keys(child.component.legends).forEach((channel: NonPositionScaleChannel) => {
      resolve.legend[channel] = parseGuideResolve(model.component.resolve, channel);

      if (resolve.legend[channel] === 'shared') {
        // If the resolve says shared (and has not been overridden)
        // We will try to merge and see if there is a conflict

        legends[channel] = mergeLegendComponent(legends[channel], child.component.legends[channel]);

        if (!legends[channel]) {
          // If merge returns nothing, there is a conflict so we cannot make the legend shared.
          // Thus, mark legend as independent and remove the legend component.
          resolve.legend[channel] = 'independent';
          delete legends[channel];
        }
      }
    });
  }

  keys(legends).forEach((channel: NonPositionScaleChannel) => {
    for (const child of model.children) {
      if (!child.component.legends[channel]) {
        // skip if the child does not have a particular legend
        continue;
      }

      if (resolve.legend[channel] === 'shared') {
        // After merging shared legend, make sure to remove legend from child
        delete child.component.legends[channel];
      }
    }
  });
  return legends;
}

export function mergeLegendComponent(mergedLegend: LegendComponent, childLegend: LegendComponent): LegendComponent {
  if (!mergedLegend) {
    return childLegend.clone();
  }
  const mergedOrient = mergedLegend.getWithExplicit('orient');
  const childOrient = childLegend.getWithExplicit('orient');

  if (mergedOrient.explicit && childOrient.explicit && mergedOrient.value !== childOrient.value) {
    // TODO: throw warning if resolve is explicit (We don't have info about explicit/implicit resolve yet.)
    // Cannot merge due to inconsistent orient
    return undefined;
  }

  let typeMerged = false;
  // Otherwise, let's merge
  for (const prop of LEGEND_COMPONENT_PROPERTIES) {
    const mergedValueWithExplicit = mergeValuesWithExplicit<LegendComponentProps, any>(
      mergedLegend.getWithExplicit(prop),
      childLegend.getWithExplicit(prop),
      prop,
      'legend',

      // Tie breaker function
      (v1: Explicit<any>, v2: Explicit<any>): any => {
        switch (prop) {
          case 'symbolType':
            return mergeSymbolType(v1, v2);
          case 'title':
            return mergeTitleComponent(v1, v2);
          case 'type':
            // There are only two types. If we have different types, then prefer symbol over gradient.
            typeMerged = true;
            return makeImplicit('symbol');
        }
        return defaultTieBreaker<LegendComponentProps, any>(v1, v2, prop, 'legend');
      }
    );
    mergedLegend.setWithExplicit(prop, mergedValueWithExplicit);
  }
  if (typeMerged) {
    if (mergedLegend.implicit?.encode?.gradient ?? {}) {
      deleteNestedProperty(mergedLegend.implicit, ['encode', 'gradient']);
    }
    if (mergedLegend.explicit?.encode?.gradient ?? {}) {
      deleteNestedProperty(mergedLegend.explicit, ['encode', 'gradient']);
    }
  }

  return mergedLegend;
}

function mergeSymbolType(st1: Explicit<string>, st2: Explicit<string>) {
  if (st2.value === 'circle') {
    // prefer "circle" over "stroke"
    return st2;
  }
  return st1;
}
