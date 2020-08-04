import {isObject} from 'vega-util';
import {Field} from '../channeldef';
import {Config} from '../config';
import {Encoding} from '../encoding';
import {AreaConfig, isMarkDef, LineConfig, Mark, MarkConfig, MarkDef} from '../mark';
import {GenericUnitSpec, NormalizedUnitSpec} from '../spec';
import {isUnitSpec} from '../spec/unit';
import {stack} from '../stack';
import {keys, omit, pick} from '../util';
import {NonFacetUnitNormalizer, NormalizeLayerOrUnit, NormalizerParams} from './base';

type UnitSpecWithPathOverlay = GenericUnitSpec<Encoding<string>, Mark | MarkDef<'line' | 'area' | 'rule' | 'trail'>>;

function dropLineAndPoint(markDef: MarkDef): MarkDef | Mark {
  const {point: _point, line: _line, ...mark} = markDef;

  return keys(mark).length > 1 ? mark : mark.type;
}

function dropLineAndPointFromConfig(config: Config) {
  for (const mark of ['line', 'area', 'rule', 'trail'] as const) {
    if (config[mark]) {
      config = {
        ...config,
        // TODO: remove as any
        [mark]: omit(config[mark], ['point', 'line'] as any)
      };
    }
  }
  return config;
}

function getPointOverlay(markDef: MarkDef, markConfig: LineConfig = {}, encoding: Encoding<Field>): MarkConfig {
  if (markDef.point === 'transparent') {
    return {opacity: 0};
  } else if (markDef.point) {
    // truthy : true or object
    return isObject(markDef.point) ? markDef.point : {};
  } else if (markDef.point !== undefined) {
    // false or null
    return null;
  } else {
    // undefined (not disabled)
    if (markConfig.point || encoding.shape) {
      // enable point overlay if config[mark].point is truthy or if encoding.shape is provided
      return isObject(markConfig.point) ? markConfig.point : {};
    }
    // markDef.point is defined as falsy
    return undefined;
  }
}

function getLineOverlay(markDef: MarkDef, markConfig: AreaConfig = {}): MarkConfig {
  if (markDef.line) {
    // true or object
    return markDef.line === true ? {} : markDef.line;
  } else if (markDef.line !== undefined) {
    // false or null
    return null;
  } else {
    // undefined (not disabled)
    if (markConfig.line) {
      // enable line overlay if config[mark].line is truthy
      return markConfig.line === true ? {} : markConfig.line;
    }
    // markDef.point is defined as falsy
    return undefined;
  }
}

export class PathOverlayNormalizer implements NonFacetUnitNormalizer<UnitSpecWithPathOverlay> {
  public name = 'path-overlay';
  public hasMatchingType(spec: GenericUnitSpec<any, Mark | MarkDef>, config: Config): spec is UnitSpecWithPathOverlay {
    if (isUnitSpec(spec)) {
      const {mark, encoding} = spec;
      const markDef = isMarkDef(mark) ? mark : {type: mark};
      switch (markDef.type) {
        case 'line':
        case 'rule':
        case 'trail':
          return !!getPointOverlay(markDef, config[markDef.type], encoding);
        case 'area':
          return (
            // false / null are also included as we want to remove the properties
            !!getPointOverlay(markDef, config[markDef.type], encoding) ||
            !!getLineOverlay(markDef, config[markDef.type])
          );
      }
    }
    return false;
  }
  public run(spec: UnitSpecWithPathOverlay, params: NormalizerParams, normalize: NormalizeLayerOrUnit) {
    const {config} = params;
    const {selection, projection, encoding, mark, ...outerSpec} = spec;
    const markDef: MarkDef = isMarkDef(mark) ? mark : {type: mark};

    const pointOverlay = getPointOverlay(markDef, config[markDef.type], encoding);
    const lineOverlay = markDef.type === 'area' && getLineOverlay(markDef, config[markDef.type]);

    const layer: NormalizedUnitSpec[] = [
      {
        ...(selection ? {selection} : {}),
        // Do not include point / line overlay in the normalize spec
        mark: dropLineAndPoint({
          ...markDef,
          // make area mark translucent by default
          // TODO: extract this 0.7 to be shared with default opacity for point/tick/...
          ...(markDef.type === 'area' ? {opacity: 0.7} : {})
        }),
        // drop shape from encoding as this might be used to trigger point overlay
        encoding: omit(encoding, ['shape'])
      }
    ];

    // FIXME: determine rules for applying selections.

    // Need to copy stack config to overlayed layer
    const stackProps = stack(markDef, encoding);

    let overlayEncoding = encoding;
    if (stackProps) {
      const {fieldChannel: stackFieldChannel, offset} = stackProps;
      overlayEncoding = {
        ...encoding,
        [stackFieldChannel]: {
          ...encoding[stackFieldChannel],
          ...(offset ? {stack: offset} : {})
        }
      };
    }

    if (lineOverlay) {
      layer.push({
        ...(projection ? {projection} : {}),
        mark: {
          type: 'line',
          ...pick(markDef, ['clip', 'interpolate', 'tension', 'tooltip']),
          ...lineOverlay
        },
        encoding: overlayEncoding
      });
    }
    if (pointOverlay) {
      layer.push({
        ...(projection ? {projection} : {}),
        mark: {
          type: 'point',
          opacity: 1,
          filled: true,
          ...pick(markDef, ['clip', 'tooltip']),
          ...pointOverlay
        },
        encoding: overlayEncoding
      });
    }

    return normalize(
      {
        ...outerSpec,
        layer
      },
      {
        ...params,
        config: dropLineAndPointFromConfig(config)
      }
    );
  }
}
