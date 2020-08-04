import {NewSignal, OnEvent, Stream} from 'vega';
import {array, stringValue} from 'vega-util';
import {SelectionCompiler, SelectionComponent, STORE, TUPLE, unitName} from '.';
import {ScaleChannel, X, Y} from '../../channel';
import {warn} from '../../log';
import {hasContinuousDomain} from '../../scale';
import {SelectionInitInterval} from '../../selection';
import {keys} from '../../util';
import {UnitModel} from '../unit';
import {assembleInit} from './assemble';
import {SelectionProjection, TUPLE_FIELDS} from './transforms/project';
import scales from './transforms/scales';

export const BRUSH = '_brush';
export const SCALE_TRIGGER = '_scale_trigger';

const interval: SelectionCompiler<'interval'> = {
  signals: (model, selCmpt) => {
    const name = selCmpt.name;
    const fieldsSg = name + TUPLE_FIELDS;
    const hasScales = scales.has(selCmpt);
    const signals: NewSignal[] = [];
    const dataSignals: string[] = [];
    const scaleTriggers: {
      scaleName: string;
      expr: string;
    }[] = [];

    if (selCmpt.translate && !hasScales) {
      const filterExpr = `!event.item || event.item.mark.name !== ${stringValue(name + BRUSH)}`;
      events(selCmpt, (on: OnEvent[], evt: Stream) => {
        const filters = array(evt.between[0].filter ?? (evt.between[0].filter = []));
        if (filters.indexOf(filterExpr) < 0) {
          filters.push(filterExpr);
        }
        return on;
      });
    }

    selCmpt.project.items.forEach((proj, i) => {
      const channel = proj.channel;
      if (channel !== X && channel !== Y) {
        warn('Interval selections only support x and y encoding channels.');
        return;
      }

      const init = selCmpt.init ? selCmpt.init[i] : null;
      const cs = channelSignals(model, selCmpt, proj, init);
      const dname = proj.signals.data;
      const vname = proj.signals.visual;
      const scaleName = stringValue(model.scaleName(channel));
      const scaleType = model.getScaleComponent(channel).get('type');
      const toNum = hasContinuousDomain(scaleType) ? '+' : '';

      signals.push(...cs);
      dataSignals.push(dname);

      scaleTriggers.push({
        scaleName: model.scaleName(channel),
        expr:
          `(!isArray(${dname}) || ` +
          `(${toNum}invert(${scaleName}, ${vname})[0] === ${toNum}${dname}[0] && ` +
          `${toNum}invert(${scaleName}, ${vname})[1] === ${toNum}${dname}[1]))`
      });
    });

    // Proxy scale reactions to ensure that an infinite loop doesn't occur
    // when an interval selection filter touches the scale.
    if (!hasScales) {
      signals.push({
        name: name + SCALE_TRIGGER,
        value: {},
        on: [
          {
            events: scaleTriggers.map(t => ({scale: t.scaleName})),
            update: scaleTriggers.map(t => t.expr).join(' && ') + ` ? ${name + SCALE_TRIGGER} : {}`
          }
        ]
      });
    }

    // Only add an interval to the store if it has valid data extents. Data extents
    // are set to null if pixel extents are equal to account for intervals over
    // ordinal/nominal domains which, when inverted, will still produce a valid datum.
    const init = selCmpt.init;
    const update = `unit: ${unitName(model)}, fields: ${fieldsSg}, values`;
    return signals.concat({
      name: name + TUPLE,
      ...(init ? {init: `{${update}: ${assembleInit(init)}}`} : {}),
      on: [
        {
          events: [{signal: dataSignals.join(' || ')}], // Prevents double invocation, see https://github.com/vega/vega#1672.
          update: dataSignals.join(' && ') + ` ? {${update}: [${dataSignals}]} : null`
        }
      ]
    });
  },

  modifyExpr: (model, selCmpt) => {
    const tpl = selCmpt.name + TUPLE;
    return tpl + ', ' + (selCmpt.resolve === 'global' ? 'true' : `{unit: ${unitName(model)}}`);
  },

  marks: (model, selCmpt, marks) => {
    const name = selCmpt.name;
    const {x, y} = selCmpt.project.hasChannel;
    const xvname = x && x.signals.visual;
    const yvname = y && y.signals.visual;
    const store = `data(${stringValue(selCmpt.name + STORE)})`;

    // Do not add a brush if we're binding to scales.
    if (scales.has(selCmpt)) {
      return marks;
    }

    const update: any = {
      x: x !== undefined ? {signal: `${xvname}[0]`} : {value: 0},
      y: y !== undefined ? {signal: `${yvname}[0]`} : {value: 0},
      x2: x !== undefined ? {signal: `${xvname}[1]`} : {field: {group: 'width'}},
      y2: y !== undefined ? {signal: `${yvname}[1]`} : {field: {group: 'height'}}
    };

    // If the selection is resolved to global, only a single interval is in
    // the store. Wrap brush mark's encodings with a production rule to test
    // this based on the `unit` property. Hide the brush mark if it corresponds
    // to a unit different from the one in the store.
    if (selCmpt.resolve === 'global') {
      for (const key of keys(update)) {
        update[key] = [
          {
            test: `${store}.length && ${store}[0].unit === ${unitName(model)}`,
            ...update[key]
          },
          {value: 0}
        ];
      }
    }

    // Two brush marks ensure that fill colors and other aesthetic choices do
    // not interefere with the core marks, but that the brushed region can still
    // be interacted with (e.g., dragging it around).
    const {fill, fillOpacity, cursor, ...stroke} = selCmpt.mark;
    const vgStroke = keys(stroke).reduce((def, k) => {
      def[k] = [
        {
          test: [x !== undefined && `${xvname}[0] !== ${xvname}[1]`, y !== undefined && `${yvname}[0] !== ${yvname}[1]`]
            .filter(t => t)
            .join(' && '),
          value: stroke[k]
        },
        {value: null}
      ];
      return def;
    }, {});

    return [
      {
        name: name + BRUSH + '_bg',
        type: 'rect',
        clip: true,
        encode: {
          enter: {
            fill: {value: fill},
            fillOpacity: {value: fillOpacity}
          },
          update: update
        }
      },
      ...marks,
      {
        name: name + BRUSH,
        type: 'rect',
        clip: true,
        encode: {
          enter: {
            ...(cursor ? {cursor: {value: cursor}} : {}),
            fill: {value: 'transparent'}
          },
          update: {...update, ...vgStroke}
        }
      }
    ];
  }
};
export default interval;

/**
 * Returns the visual and data signals for an interval selection.
 */
function channelSignals(
  model: UnitModel,
  selCmpt: SelectionComponent<'interval'>,
  proj: SelectionProjection,
  init?: SelectionInitInterval
): NewSignal[] {
  const channel = proj.channel;
  const vname = proj.signals.visual;
  const dname = proj.signals.data;
  const hasScales = scales.has(selCmpt);
  const scaleName = stringValue(model.scaleName(channel));
  const scale = model.getScaleComponent(channel as ScaleChannel);
  const scaleType = scale ? scale.get('type') : undefined;
  const scaled = (str: string) => `scale(${scaleName}, ${str})`;
  const size = model.getSizeSignalRef(channel === X ? 'width' : 'height').signal;
  const coord = `${channel}(unit)`;

  const on = events(selCmpt, (def: OnEvent[], evt: Stream) => {
    return [
      ...def,
      {events: evt.between[0], update: `[${coord}, ${coord}]`}, // Brush Start
      {events: evt, update: `[${vname}[0], clamp(${coord}, 0, ${size})]`} // Brush End
    ];
  });

  // React to pan/zooms of continuous scales. Non-continuous scales
  // (band, point) cannot be pan/zoomed and any other changes
  // to their domains (e.g., filtering) should clear the brushes.
  on.push({
    events: {signal: selCmpt.name + SCALE_TRIGGER},
    update: hasContinuousDomain(scaleType) ? `[${scaled(`${dname}[0]`)}, ${scaled(`${dname}[1]`)}]` : `[0, 0]`
  });

  return hasScales
    ? [{name: dname, on: []}]
    : [
        {
          name: vname,
          ...(init ? {init: assembleInit(init, true, scaled)} : {value: []}),
          on: on
        },
        {
          name: dname,
          ...(init ? {init: assembleInit(init)} : {}), // Cannot be `value` as `init` may require datetime exprs.
          on: [
            {
              events: {signal: vname},
              update: `${vname}[0] === ${vname}[1] ? null : invert(${scaleName}, ${vname})`
            }
          ]
        }
      ];
}

function events(selCmpt: SelectionComponent<'interval'>, cb: (def: OnEvent[], evt: Stream) => OnEvent[]): OnEvent[] {
  return selCmpt.events.reduce((on, evt) => {
    if (!evt.between) {
      warn(`${evt} is not an ordered event stream for interval selections.`);
      return on;
    }
    return cb(on, evt);
  }, [] as OnEvent[]);
}
