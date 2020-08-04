import {canvas} from 'vega-canvas';

export var context = (context = canvas(1,1))
  ? context.getContext('2d')
  : null;
