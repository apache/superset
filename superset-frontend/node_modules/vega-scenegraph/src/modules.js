import CanvasHandler from './CanvasHandler';
import CanvasRenderer from './CanvasRenderer';
import SVGHandler from './SVGHandler';
import SVGRenderer from './SVGRenderer';
import SVGStringRenderer from './SVGStringRenderer';

var Canvas = 'canvas';
var PNG = 'png';
var SVG = 'svg';
var None = 'none';

export var RenderType = {
  Canvas: Canvas,
  PNG:    PNG,
  SVG:    SVG,
  None:   None
};

var modules = {};

modules[Canvas] = modules[PNG] = {
  renderer: CanvasRenderer,
  headless: CanvasRenderer,
  handler:  CanvasHandler
};

modules[SVG] = {
  renderer: SVGRenderer,
  headless: SVGStringRenderer,
  handler:  SVGHandler
};

modules[None] = {};

export function renderModule(name, _) {
  name = String(name || '').toLowerCase();
  if (arguments.length > 1) {
    modules[name] = _;
    return this;
  } else {
    return modules[name];
  }
}
