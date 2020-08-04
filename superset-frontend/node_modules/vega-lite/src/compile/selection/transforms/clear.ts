import {Update} from 'vega';
import {selector as parseSelector} from 'vega-event-selector';
import {isString} from 'vega-util';
import {TUPLE} from '..';
import {varName} from '../../../util';
import inputBindings from './inputs';
import toggle, {TOGGLE} from './toggle';
import {TransformCompiler} from './transforms';

const clear: TransformCompiler = {
  has: selCmpt => {
    return selCmpt.clear !== undefined && selCmpt.clear !== false;
  },

  parse: (model, selCmpt, selDef) => {
    if (selDef.clear) {
      selCmpt.clear = isString(selDef.clear) ? parseSelector(selDef.clear, 'scope') : selDef.clear;
    }
  },

  topLevelSignals: (model, selCmpt, signals) => {
    if (inputBindings.has(selCmpt)) {
      selCmpt.project.items.forEach(proj => {
        const idx = signals.findIndex(n => n.name === varName(`${selCmpt.name}_${proj.field}`));
        if (idx !== -1) {
          signals[idx].on.push({events: selCmpt.clear, update: 'null'});
        }
      });
    }

    return signals;
  },

  signals: (model, selCmpt, signals) => {
    function addClear(idx: number, update: Update) {
      if (idx !== -1 && signals[idx].on) {
        signals[idx].on.push({events: selCmpt.clear, update});
      }
    }

    // Be as minimalist as possible when adding clear triggers to minimize dataflow execution.
    if (selCmpt.type === 'interval') {
      selCmpt.project.items.forEach(proj => {
        const vIdx = signals.findIndex(n => n.name === proj.signals.visual);
        addClear(vIdx, '[0, 0]');

        if (vIdx === -1) {
          const dIdx = signals.findIndex(n => n.name === proj.signals.data);
          addClear(dIdx, 'null');
        }
      });
    } else {
      let tIdx = signals.findIndex(n => n.name === selCmpt.name + TUPLE);
      addClear(tIdx, 'null');

      if (toggle.has(selCmpt)) {
        tIdx = signals.findIndex(n => n.name === selCmpt.name + TOGGLE);
        addClear(tIdx, 'false');
      }
    }

    return signals;
  }
};

export default clear;
