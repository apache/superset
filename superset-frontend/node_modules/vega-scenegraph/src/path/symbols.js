import pathParse from './parse';
import pathRender from './render';
import {HalfSqrt3, Tau} from '../util/constants';
import {hasOwnProperty} from 'vega-util';

var Tan30 = 0.5773502691896257;

var builtins = {
  'circle': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2;
      context.moveTo(r, 0);
      context.arc(0, 0, r, 0, Tau);
    }
  },
  'cross': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          s = r / 2.5;
      context.moveTo(-r, -s);
      context.lineTo(-r, s);
      context.lineTo(-s, s);
      context.lineTo(-s, r);
      context.lineTo(s, r);
      context.lineTo(s, s);
      context.lineTo(r, s);
      context.lineTo(r, -s);
      context.lineTo(s, -s);
      context.lineTo(s, -r);
      context.lineTo(-s, -r);
      context.lineTo(-s, -s);
      context.closePath();
    }
  },
  'diamond': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2;
      context.moveTo(-r, 0);
      context.lineTo(0, -r);
      context.lineTo(r, 0);
      context.lineTo(0, r);
      context.closePath();
    }
  },
  'square': {
    draw: function(context, size) {
      var w = Math.sqrt(size),
          x = -w / 2;
      context.rect(x, x, w, w);
    }
  },
  'arrow': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          s = r / 7,
          t = r / 2.5,
          v = r / 8;
      context.moveTo(-s, r);
      context.lineTo(s, r);
      context.lineTo(s, -v);
      context.lineTo(t, -v);
      context.lineTo(0, -r);
      context.lineTo(-t, -v);
      context.lineTo(-s, -v);
      context.closePath();
    }
  },
  'wedge': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = HalfSqrt3 * r,
          o = (h - r * Tan30),
          b = r / 4;
      context.moveTo(0, -h - o);
      context.lineTo(-b, h - o);
      context.lineTo(b, h - o);
      context.closePath();
    }
  },
  'triangle': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = HalfSqrt3 * r,
          o = (h - r * Tan30);
      context.moveTo(0, -h - o);
      context.lineTo(-r, h - o);
      context.lineTo(r, h - o);
      context.closePath();
    }
  },
  'triangle-up': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = HalfSqrt3 * r;
      context.moveTo(0, -h);
      context.lineTo(-r, h);
      context.lineTo(r, h);
      context.closePath();
    }
  },
  'triangle-down': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = HalfSqrt3 * r;
      context.moveTo(0, h);
      context.lineTo(-r, -h);
      context.lineTo(r, -h);
      context.closePath();
    }
  },
  'triangle-right': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = HalfSqrt3 * r;
      context.moveTo(h, 0);
      context.lineTo(-h, -r);
      context.lineTo(-h, r);
      context.closePath();
    }
  },
  'triangle-left': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2,
          h = HalfSqrt3 * r;
      context.moveTo(-h, 0);
      context.lineTo(h, -r);
      context.lineTo(h, r);
      context.closePath();
    }
  },
  'stroke': {
    draw: function(context, size) {
      var r = Math.sqrt(size) / 2;
      context.moveTo(-r, 0);
      context.lineTo(r, 0);
    }
  }
};

export default function symbols(_) {
  return hasOwnProperty(builtins, _) ? builtins[_] : customSymbol(_);
}

var custom = {};

function customSymbol(path) {
  if (!hasOwnProperty(custom, path)) {
    var parsed = pathParse(path);
    custom[path] = {
      draw: function(context, size) {
        pathRender(context, parsed, 0, 0, Math.sqrt(size) / 2);
      }
    };
  }
  return custom[path];
}
