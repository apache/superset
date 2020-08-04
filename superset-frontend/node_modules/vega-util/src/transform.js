import {identity} from './accessors';
import peek from './peek';
import toNumber from './toNumber';

function exp(sign) {
  return function(x) { return sign * Math.exp(x); };
}

function log(sign) {
  return function(x) { return Math.log(sign * x); };
}

function symlog(c) {
  return function(x) { return Math.sign(x) * Math.log1p(Math.abs(x / c)); };
}

function symexp(c) {
  return function(x) { return Math.sign(x) * Math.expm1(Math.abs(x)) * c; };
}

function pow(exponent) {
  return function(x) {
    return x < 0 ? -Math.pow(-x, exponent) : Math.pow(x, exponent);
  };
}

function pan(domain, delta, lift, ground) {
  var d0 = lift(domain[0]),
      d1 = lift(peek(domain)),
      dd = (d1 - d0) * delta;

  return [
    ground(d0 - dd),
    ground(d1 - dd)
  ];
}

export function panLinear(domain, delta) {
  return pan(domain, delta, toNumber, identity);
}

export function panLog(domain, delta) {
  var sign = Math.sign(domain[0]);
  return pan(domain, delta, log(sign), exp(sign));
}

export function panPow(domain, delta, exponent) {
  return pan(domain, delta, pow(exponent), pow(1/exponent));
}

export function panSymlog(domain, delta, constant) {
  return pan(domain, delta, symlog(constant), symexp(constant));
}

function zoom(domain, anchor, scale, lift, ground) {
  var d0 = lift(domain[0]),
      d1 = lift(peek(domain)),
      da = anchor != null ? lift(anchor) : (d0 + d1) / 2;

  return [
    ground(da + (d0 - da) * scale),
    ground(da + (d1 - da) * scale)
  ];
}

export function zoomLinear(domain, anchor, scale) {
  return zoom(domain, anchor, scale, toNumber, identity);
}

export function zoomLog(domain, anchor, scale) {
  var sign = Math.sign(domain[0]);
  return zoom(domain, anchor, scale, log(sign), exp(sign));
}

export function zoomPow(domain, anchor, scale, exponent) {
  return zoom(domain, anchor, scale, pow(exponent), pow(1/exponent));
}

export function zoomSymlog(domain, anchor, scale, constant) {
  return zoom(domain, anchor, scale, symlog(constant), symexp(constant));
}
