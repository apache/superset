import {initializeAria} from './aria';
import bind from './bind';
import element from './element';
import initializeRenderer from './initialize-renderer';
import initializeHandler from './initialize-handler';
import {CanvasHandler, renderModule} from 'vega-scenegraph';

export default function(el, elBind) {
  const view = this,
        type = view._renderType,
        config = view._eventConfig.bind,
        module = renderModule(type);

  // containing dom element
  el = view._el = el ? lookup(view, el) : null;

  // initialize aria attributes
  initializeAria(view);

  // select appropriate renderer & handler
  if (!module) view.error('Unrecognized renderer type: ' + type);
  const Handler = module.handler || CanvasHandler,
        Renderer = (el ? module.renderer : module.headless);

  // initialize renderer and input handler
  view._renderer = !Renderer ? null
    : initializeRenderer(view, view._renderer, el, Renderer);
  view._handler = initializeHandler(view, view._handler, el, Handler);
  view._redraw = true;

  // initialize signal bindings
  if (el && config !== 'none') {
    elBind = elBind ? (view._elBind = lookup(view, elBind))
      : el.appendChild(element('form', {'class': 'vega-bindings'}));

    view._bind.forEach(function(_) {
      if (_.param.element && config !== 'container') {
        _.element = lookup(view, _.param.element);
      }
    });

    view._bind.forEach(function(_) {
      bind(view, _.element || elBind, _);
    });
  }

  return view;
}

function lookup(view, el) {
  if (typeof el === 'string') {
    if (typeof document !== 'undefined') {
      el = document.querySelector(el);
      if (!el) {
        view.error('Signal bind element not found: ' + el);
        return null;
      }
    } else {
      view.error('DOM document instance not found.');
      return null;
    }
  }
  if (el) {
    try {
      el.innerHTML = '';
    } catch (e) {
      el = null;
      view.error(e);
    }
  }
  return el;
}
