import {resetSVGGradientId} from './src/Gradient';
import {resetSVGClipId} from './src/util/svg/clip';

export {default as Bounds} from './src/Bounds';
export {default as Gradient} from './src/Gradient';
export {default as GroupItem} from './src/GroupItem';
export {default as ResourceLoader} from './src/ResourceLoader';
export {default as Item} from './src/Item';
export {default as Scenegraph} from './src/Scenegraph';

export {default as Handler} from './src/Handler';
export {default as Renderer} from './src/Renderer';
export {default as CanvasHandler} from './src/CanvasHandler';
export {default as CanvasRenderer} from './src/CanvasRenderer';
export {default as SVGHandler} from './src/SVGHandler';
export {default as SVGRenderer} from './src/SVGRenderer';
export {default as SVGStringRenderer} from './src/SVGStringRenderer';
export {RenderType, renderModule} from './src/modules';
export {intersect} from './src/intersect';

export {default as Marks} from './src/marks/index';

export {default as boundClip} from './src/bound/boundClip';
export {default as boundContext} from './src/bound/boundContext';
export {default as boundStroke} from './src/bound/boundStroke';
export {default as boundItem} from './src/bound/boundItem';
export {default as boundMark} from './src/bound/boundMark';

export {default as pathCurves} from './src/path/curves';
export {default as pathSymbols} from './src/path/symbols';
export {default as pathRectangle} from './src/path/rectangle';
export {default as pathTrail} from './src/path/trail';
export {default as pathParse} from './src/path/parse';
export {default as pathRender} from './src/path/render';

export {default as point} from './src/util/point';
export {domCreate, domFind, domChild, domClear} from './src/util/dom';
export {openTag, closeTag} from './src/util/tags';
export {
  font,
  fontFamily,
  fontSize,
  lineHeight,
  multiLineOffset,
  textMetrics
} from './src/util/text';

export {sceneEqual, pathEqual} from './src/util/equal';
export {sceneToJSON, sceneFromJSON} from './src/util/serialize';
export {
  intersectPath,
  intersectPoint,
  intersectRule,
  intersectBoxLine
} from './src/util/intersect';
export {
  zorder as sceneZOrder,
  visit as sceneVisit,
  pickVisit as scenePickVisit
} from './src/util/visit';

// deprecated, remove in next major version
export {resetSVGClipId} from './src/util/svg/clip';

export function resetSVGDefIds() {
  resetSVGClipId();
  resetSVGGradientId();
}
