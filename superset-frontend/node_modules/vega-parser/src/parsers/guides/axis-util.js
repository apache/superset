import {extend, stringValue} from 'vega-util';
import {Bottom, Left, Right, Top} from './constants';
import {encoder} from '../encode/util';
import {isSignal} from '../../util';

const isX = orient => orient === Bottom || orient === Top;

// get sign coefficient based on axis orient
export const getSign = (orient, a, b) => isSignal(orient)
  ? ifLeftTopExpr(orient.signal, a, b)
  : orient === Left || orient === Top ? a : b;

// condition on axis x-direction
export const ifX = (orient, a, b) => isSignal(orient)
  ? ifXEnc(orient.signal, a, b)
  : isX(orient) ? a : b;

// condition on axis y-direction
export const ifY = (orient, a, b) => isSignal(orient)
  ? ifYEnc(orient.signal, a, b)
  : isX(orient) ? b : a;

export const ifTop = (orient, a, b) => isSignal(orient)
  ? ifTopExpr(orient.signal, a, b)
  : orient === Top ? {value: a} : {value: b};

export const ifRight = (orient, a, b) => isSignal(orient)
  ? ifRightExpr(orient.signal, a, b)
  : orient === Right ? {value: a} : {value: b};

const ifXEnc = ($orient, a, b) => ifEnc(
  `${$orient} === '${Top}' || ${$orient} === '${Bottom}'`, a, b
);

const ifYEnc = ($orient, a, b) => ifEnc(
  `${$orient} !== '${Top}' && ${$orient} !== '${Bottom}'`, a, b
);

const ifLeftTopExpr = ($orient, a, b) => ifExpr(
  `${$orient} === '${Left}' || ${$orient} === '${Top}'`, a, b
);

const ifTopExpr = ($orient, a, b) => ifExpr(
  `${$orient} === '${Top}'`, a, b
);

const ifRightExpr = ($orient, a, b) => ifExpr(
  `${$orient} === '${Right}'`, a, b
);

const ifEnc = (test, a, b) => {
  // ensure inputs are encoder objects (or null)
  a = a != null ? encoder(a) : a;
  b = b != null ? encoder(b) : b;

  if (isSimple(a) && isSimple(b)) {
    // if possible generate simple signal expression
    a = a ? (a.signal || stringValue(a.value)) : null;
    b = b ? (b.signal || stringValue(b.value)) : null;
    return {signal: `${test} ? (${a}) : (${b})`};
  } else {
    // otherwise generate rule set
    return [extend({test}, a)].concat(b || []);
  }
};

const isSimple = enc => (
  enc == null || Object.keys(enc).length === 1
);

const ifExpr = (test, a, b) => ({
  signal: `${test} ? (${toExpr(a)}) : (${toExpr(b)})`
});

export const ifOrient = ($orient, t, b, l, r) => ({
  signal: (l != null ? `${$orient} === '${Left}' ? (${toExpr(l)}) : ` : '')
        + (b != null ? `${$orient} === '${Bottom}' ? (${toExpr(b)}) : ` : '')
        + (r != null ? `${$orient} === '${Right}' ? (${toExpr(r)}) : ` : '')
        + (t != null ? `${$orient} === '${Top}' ? (${toExpr(t)}) : ` : '')
        + '(null)'
});

const toExpr = v => isSignal(v)
  ? v.signal
  : v == null ? null : stringValue(v);

export const mult = (sign, value) => value === 0 ? 0 : isSignal(sign)
  ? {signal: `(${sign.signal}) * ${value}`}
  : {value: sign * value};

export const patch = (value, base) => {
  const s = value.signal;
  return s && s.endsWith('(null)')
    ? {signal: s.slice(0, -6) + base.signal}
    : value;
};
