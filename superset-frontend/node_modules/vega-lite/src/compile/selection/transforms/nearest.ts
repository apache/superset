import * as log from '../../../log';
import {isPathMark} from '../../../mark';
import {tooltip} from '../../mark/encode';
import {TransformCompiler} from './transforms';

const VORONOI = 'voronoi';

const nearest: TransformCompiler = {
  has: selCmpt => {
    return selCmpt.type !== 'interval' && selCmpt.nearest;
  },

  parse: (model, selCmpt) => {
    // Scope selection events to the voronoi mark to prevent capturing
    // events that occur on the group mark (https://github.com/vega/vega/issues/2112).
    if (selCmpt.events) {
      for (const s of selCmpt.events) {
        s.markname = model.getName(VORONOI);
      }
    }
  },

  marks: (model, selCmpt, marks) => {
    const {x, y} = selCmpt.project.hasChannel;
    const markType = model.mark;
    if (isPathMark(markType)) {
      log.warn(log.message.nearestNotSupportForContinuous(markType));
      return marks;
    }

    const cellDef = {
      name: model.getName(VORONOI),
      type: 'path',
      interactive: true,
      from: {data: model.getName('marks')},
      encode: {
        update: {
          fill: {value: 'transparent'},
          strokeWidth: {value: 0.35},
          stroke: {value: 'transparent'},
          isVoronoi: {value: true},
          ...tooltip(model, {reactiveGeom: true})
        }
      },
      transform: [
        {
          type: 'voronoi',
          x: {expr: x || !y ? 'datum.datum.x || 0' : '0'},
          y: {expr: y || !x ? 'datum.datum.y || 0' : '0'},
          size: [model.getSizeSignalRef('width'), model.getSizeSignalRef('height')]
        }
      ]
    };

    let index = 0;
    let exists = false;
    marks.forEach((mark, i) => {
      const name = mark.name ?? '';
      if (name === model.component.mark[0].name) {
        index = i;
      } else if (name.indexOf(VORONOI) >= 0) {
        exists = true;
      }
    });

    if (!exists) {
      marks.splice(index + 1, 0, cellDef);
    }

    return marks;
  }
};

export default nearest;
