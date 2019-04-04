// event.js
// Handle keyboard/mouse/touch events in the Canvas
// TODO - this will not work under node

/* eslint-disable dot-notation, max-statements, no-loop-func */
/* global window, document */
function noop() {}

const KEYS = {
  enter: 13,
  up: 38,
  down: 40,
  left: 37,
  right: 39,
  esc: 27,
  space: 32,
  backspace: 8,
  tab: 9,
  delete: 46
};

// returns an O3D object or false otherwise.
function toO3D(n) {
  return n !== true ? n : false;
}

// Returns an element position
function _getPos(elem) {
  const bbox = elem.getBoundingClientRect();
  return {
    x: bbox.left,
    y: bbox.top,
    bbox
  };
}

// event object wrapper
export function get(e, win) {
  win = win || window;
  return e || win.event;
}

export function getWheel(e) {
  return e.wheelDelta ? e.wheelDelta / 120 : -(e.detail || 0) / 3;
}

export function getKey(e) {
  const code = e.which || e.keyCode;
  let key = keyOf(code);
  // onkeydown
  const fKey = code - 111;
  if (fKey > 0 && fKey < 13) {
    key = `f${fKey}`;
  }
  key = key || String.fromCharCode(code).toLowerCase();

  return {
    code,
    key,
    shift: e.shiftKey,
    control: e.ctrlKey,
    alt: e.altKey,
    meta: e.metaKey
  };
}

export function isRightClick(e) {
  return e.which === 3 || e.button === 2;
}

export function getPos(e, win) {
  // get mouse position
  win = win || window;
  e = e || win.event;
  let doc = win.document;
  doc = doc.documentElement || doc.body;
  // TODO(nico): make touch event handling better
  if (e.touches && e.touches.length) {
    const touchesPos = [];
    const l = e.touches.length;
    let evt;
    for (let i = 0; i < l; ++i) {
      evt = e.touches[i];
      touchesPos.push({
        x: evt.pageX || (evt.clientX + doc.scrollLeft),
        y: evt.pageY || (evt.clientY + doc.scrollTop)
      });
    }
    return touchesPos;
  }
  const page = {
    x: e.pageX || (e.clientX + doc.scrollLeft),
    y: e.pageY || (e.clientY + doc.scrollTop)
  };
  return [page];
}

export function stop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  e.cancelBubble = true;
  if (e.preventDefault) {
    e.preventDefault();
  } else {
    e.returnValue = false;
  }
}

export class EventsProxy {

  constructor(domElem, opt) {
    this.scene = opt.scene;
    this.domElem = domElem;
    this.pos = _getPos(domElem);
    this.opt = this.callbacks = opt;

    this.size = {
      width: domElem.width || domElem.offsetWidth,
      height: domElem.height || domElem.offsetHeight
    };

    this.attachEvents();
  }

  attachEvents() {
    const domElem = this.domElem;
    const opt = this.opt;

    if (opt.disableContextMenu) {
      domElem.oncontextmenu = () => false;
    }

    if (opt.enableMouse) {
      ['mouseup', 'mousedown', 'mousemove', 'mouseover', 'mouseout']
      .forEach(action => {
        domElem.addEventListener(action, (e, win) => {
          this[action](this.eventInfo(action, e, win));
        }, false);
      });

      // "well, this is embarrassing..."
      let type = '';
      if (!document.getBoxObjectFor && window.mozInnerScreenX === null) {
        type = 'mousewheel';
      } else {
        type = 'DOMMouseScroll';
      }
      domElem.addEventListener(type, (e, win) => {
        this['mousewheel'](this.eventInfo('mousewheel', e, win));
      }, false);
    }

    if (opt.enableTouch) {
      ['touchstart', 'touchmove', 'touchend'].forEach(action => {
        domElem.addEventListener(action, (e, win) => {
          this[action](this.eventInfo(action, e, win));
        }, false);
      });
    }

    if (opt.enableKeyboard) {
      ['keydown', 'keyup'].forEach(action => {
        document.addEventListener(action, (e, win) => {
          this[action](this.eventInfo(action, e, win));
        }, false);
      });
    }
  }

  eventInfo(type, e, win) {
    const domElem = this.domElem;
    const scene = this.scene;
    const opt = this.opt;
    const size = this.getSize();
    const relative = opt.relative;
    const centerOrigin = opt.centerOrigin;
    const pos = opt.cachePosition && this.pos || _getPos(domElem);
    const ge = get(e, win);
    const epos = getPos(e, win);
    const origPos = {x: epos[0].x, y: epos[0].y};
    const evt = {};
    let x;
    let y;

    // get Position
    for (let i = 0, l = epos.length; i < l; ++i) {
      x = epos[i].x;
      y = epos[i].y;
      if (relative) {
        x -= pos.x; y -= pos.y;
        if (centerOrigin) {
          x -= size.width / 2;
          y -= size.height / 2;
          // y axis now points to the top of the screen
          y *= -1;
        }
      }
      epos[i].x = x;
      epos[i].y = y;
    }

    switch (type) {
    case 'mousewheel':
      evt.wheel = getWheel(ge);
      break;
    case 'keydown':
    case 'keyup':
      Object.assign(evt, getKey(ge));
      break;
    case 'mouseup':
      evt.isRightClick = isRightClick(ge);
      break;
    default:
      break;
    }

    let cacheTarget;

    Object.assign(evt, {
      x: epos[0].x,
      y: epos[0].y,
      posArray: epos,

      cache: false,
      // stop event propagation
      stop() {
        stop(ge);
      },
      // get the target element of the event
      getTarget() {
        if (cacheTarget) {
          return cacheTarget;
        }
        return (cacheTarget = opt.picking &&
          scene.pick(origPos.x - pos.x, origPos.y - pos.y) || true);
      }
    });
    // wrap native event
    evt.event = ge;

    return evt;
  }

  getSize() {
    if (this.cacheSize) {
      return this.size;
    }
    const domElem = this.domElem;
    return {
      width: domElem.width || domElem.offsetWidth,
      height: domElem.height || domElem.offsetHeight
    };
  }

  mouseup(e) {
    if (!this.moved) {
      if (e.isRightClick) {
        this.callbacks.onRightClick(e, this.hovered);
      } else {
        this.callbacks.onClick(e, toO3D(this.pressed));
      }
    }
    if (this.pressed) {
      if (this.moved) {
        this.callbacks.onDragEnd(e, toO3D(this.pressed));
      } else {
        this.callbacks.onDragCancel(e, toO3D(this.pressed));
      }
      this.pressed = this.moved = false;
    }
  }

  mouseout(e) {
    // mouseout canvas
    let rt = e.relatedTarget;
    const domElem = this.domElem;
    while (rt && rt.parentNode) {
      if (domElem === rt.parentNode) {
        return;
      }
      rt = rt.parentNode;
    }
    if (this.hovered) {
      this.callbacks.onMouseLeave(e, this.hovered);
      this.hovered = false;
    }
    if (this.pressed && this.moved) {
      this.callbacks.onDragEnd(e);
      this.pressed = this.moved = false;
    }
  }

  mouseover(e) {
  }

  mousemove(e) {
    if (this.pressed) {
      this.moved = true;
      this.callbacks.onDragMove(e, toO3D(this.pressed));
      return;
    }
    if (this.hovered) {
      const target = toO3D(e.getTarget());
      if (!target || target.hash !== this.hash) {
        this.callbacks.onMouseLeave(e, this.hovered);
        this.hovered = target;
        this.hash = target;
        if (target) {
          this.hash = target.hash;
          this.callbacks.onMouseEnter(e, this.hovered);
        }
      } else {
        this.callbacks.onMouseMove(e, this.hovered);
      }
    } else {
      this.hovered = toO3D(e.getTarget());
      this.hash = this.hovered;
      if (this.hovered) {
        this.hash = this.hovered.hash;
        this.callbacks.onMouseEnter(e, this.hovered);
      }
    }
    if (!this.opt.picking) {
      this.callbacks.onMouseMove(e);
    }
  }

  mousewheel(e) {
    this.callbacks.onMouseWheel(e);
  }

  mousedown(e) {
    this.pressed = e.getTarget();
    this.callbacks.onDragStart(e, toO3D(this.pressed));
  }

  touchstart(e) {
    this.touched = e.getTarget();
    this.touchedLastPosition = {x: e.x, y: e.y};
    this.callbacks.onTouchStart(e, toO3D(this.touched));
  }

  touchmove(e) {
    if (this.touched) {
      this.touchMoved = true;
      this.callbacks.onTouchMove(e, toO3D(this.touched));
    }
  }

  touchend(e) {
    if (this.touched) {
      if (this.touchMoved) {
        this.callbacks.onTouchEnd(e, toO3D(this.touched));
      } else {
        e.x = isNaN(e.x) ? this.touchedLastPosition.x : e.x;
        e.y = isNaN(e.y) ? this.touchedLastPosition.y : e.y;
        this.callbacks.onTap(e, toO3D(this.touched));
        this.callbacks.onTouchCancel(e, toO3D(this.touched));
      }
      this.touched = this.touchMoved = false;
    }
  }

  keydown(e) {
    this.callbacks.onKeyDown(e);
  }

  keyup(e) {
    this.callbacks.onKeyUp(e);
  }
}

Object.assign(EventsProxy.prototype, {
  hovered: false,
  pressed: false,
  touched: false,
  touchedLastPosition: {x: 0, y: 0},
  touchMoved: false,
  moved: false
});

const DEFAULT_OPTS = {
  cachePosition: true,
  cacheSize: true,
  relative: true,
  centerOrigin: true,
  disableContextMenu: true,
  bind: false,
  picking: false,

  enableTouch: true,
  enableMouse: true,
  enableKeyboard: true,

  onClick: noop,
  onRightClick: noop,
  onDragStart: noop,
  onDragMove: noop,
  onDragEnd: noop,
  onDragCancel: noop,
  onTouchStart: noop,
  onTouchMove: noop,
  onTouchEnd: noop,
  onTouchCancel: noop,
  onTap: noop,
  onMouseMove: noop,
  onMouseEnter: noop,
  onMouseLeave: noop,
  onMouseWheel: noop,
  onKeyDown: noop,
  onKeyUp: noop
};

export const Keys = KEYS;

function keyOf(code) {
  const keyMap = Keys;
  for (const name in keyMap) {
    if (keyMap[name] === code) {
      return name;
    }
  }
  return null;
}

export function addEvents(domElement, opt = {}) {
  opt = Object.assign({}, DEFAULT_OPTS, opt);

  const bind = opt.bind;
  if (bind) {
    for (const name in opt) {
      if (name.match(/^on[a-zA-Z0-9]+$/)) {
        ((fname, fn) => {
          opt[fname] = function f() {
            fn.apply(bind, Array.prototype.slice.call(arguments));
          };
        })(name, opt[name]);
      }
    }
  }

  return new EventsProxy(domElement, opt);
}

export function removeEvents(domElement, opt = {}) {
  opt = Object.assign({}, DEFAULT_OPTS, opt);

  const bind = opt.bind;
  if (bind) {
    for (const name in opt) {
      if (name.match(/^on[a-zA-Z0-9]+$/)) {
        ((fname, fn) => {
          opt[fname] = function f() {
            fn.apply(bind, Array.prototype.slice.call(arguments));
          };
        })(name, opt[name]);
      }
    }
  }

  return new EventsProxy(domElement, opt);
}
