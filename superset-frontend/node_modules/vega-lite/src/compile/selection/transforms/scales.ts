import {stringValue} from 'vega-util';
import {VL_SELECTION_RESOLVE} from '..';
import {Channel, isScaleChannel, X, Y} from '../../../channel';
import * as log from '../../../log';
import {hasContinuousDomain} from '../../../scale';
import {UnitModel} from '../../unit';
import {SelectionProjection} from './project';
import {TransformCompiler} from './transforms';
import {isLayerModel, Model} from '../../model';

const scaleBindings: TransformCompiler = {
  has: selCmpt => {
    return selCmpt.type === 'interval' && selCmpt.resolve === 'global' && selCmpt.bind && selCmpt.bind === 'scales';
  },

  parse: (model, selCmpt) => {
    const bound: SelectionProjection[] = (selCmpt.scales = []);

    for (const proj of selCmpt.project.items) {
      const channel = proj.channel;

      if (!isScaleChannel(channel)) {
        continue;
      }

      const scale = model.getScaleComponent(channel);
      const scaleType = scale ? scale.get('type') : undefined;

      if (!scale || !hasContinuousDomain(scaleType)) {
        log.warn(log.message.SCALE_BINDINGS_CONTINUOUS);
        continue;
      }

      const extent = {selection: selCmpt.name, field: proj.field};
      scale.set('selectionExtent', extent, true);
      bound.push(proj);

      // Bind both x/y for diag plot of repeated views.
      if (model.repeater && model.repeater.row === model.repeater.column) {
        const scale2 = model.getScaleComponent(channel === X ? Y : X);
        scale2.set('selectionExtent', extent, true);
      }
    }
  },

  topLevelSignals: (model, selCmpt, signals) => {
    const bound = selCmpt.scales.filter(proj => signals.filter(s => s.name === proj.signals.data).length === 0);

    // Top-level signals are only needed for multiview displays and if this
    // view's top-level signals haven't already been generated.
    if (!model.parent || isTopLevelLayer(model) || bound.length === 0) {
      return signals;
    }

    // vlSelectionResolve does not account for the behavior of bound scales in
    // multiview displays. Each unit view adds a tuple to the store, but the
    // state of the selection is the unit selection most recently updated. This
    // state is captured by the top-level signals that we insert and "push
    // outer" to from within the units. We need to reassemble this state into
    // the top-level named signal, except no single selCmpt has a global view.
    const namedSg = signals.filter(s => s.name === selCmpt.name)[0];
    let update = namedSg.update;
    if (update.indexOf(VL_SELECTION_RESOLVE) >= 0) {
      namedSg.update = `{${bound.map(proj => `${stringValue(proj.field)}: ${proj.signals.data}`).join(', ')}}`;
    } else {
      for (const proj of bound) {
        const mapping = `${stringValue(proj.field)}: ${proj.signals.data}`;
        if (update.indexOf(mapping) < 0) {
          update = `${update.substring(0, update.length - 1)}, ${mapping}}`;
        }
      }
      namedSg.update = update;
    }

    return signals.concat(bound.map(proj => ({name: proj.signals.data})));
  },

  signals: (model, selCmpt, signals) => {
    // Nested signals need only push to top-level signals with multiview displays.
    if (model.parent && !isTopLevelLayer(model)) {
      for (const proj of selCmpt.scales) {
        const signal: any = signals.filter(s => s.name === proj.signals.data)[0];
        signal.push = 'outer';
        delete signal.value;
        delete signal.update;
      }
    }

    return signals;
  }
};

export default scaleBindings;

export function domain(model: UnitModel, channel: Channel) {
  const scale = stringValue(model.scaleName(channel));
  return `domain(${scale})`;
}

function isTopLevelLayer(model: Model): boolean {
  return model.parent && isLayerModel(model.parent) && (!model.parent.parent ?? isTopLevelLayer(model.parent.parent));
}
