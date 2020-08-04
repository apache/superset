import {offset} from './render-size';
import trap from './trap';

export default function(view, prevHandler, el, constructor) {
  // instantiate scenegraph handler
  var handler = new constructor(view.loader(), trap(view, view.tooltip()))
    .scene(view.scenegraph().root)
    .initialize(el, offset(view), view);

  // transfer event handlers
  if (prevHandler) {
    prevHandler.handlers().forEach(function(h) {
      handler.on(h.type, h.handler);
    });
  }

  return handler;
}
