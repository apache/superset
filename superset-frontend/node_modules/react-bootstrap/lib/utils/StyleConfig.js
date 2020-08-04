"use strict";

exports.__esModule = true;
exports.Style = exports.State = exports.DEVICE_SIZES = exports.SIZE_MAP = exports.Size = void 0;
var Size = {
  LARGE: 'large',
  SMALL: 'small',
  XSMALL: 'xsmall'
};
exports.Size = Size;
var SIZE_MAP = {
  large: 'lg',
  medium: 'md',
  small: 'sm',
  xsmall: 'xs',
  lg: 'lg',
  md: 'md',
  sm: 'sm',
  xs: 'xs'
};
exports.SIZE_MAP = SIZE_MAP;
var DEVICE_SIZES = ['lg', 'md', 'sm', 'xs'];
exports.DEVICE_SIZES = DEVICE_SIZES;
var State = {
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
  INFO: 'info'
};
exports.State = State;
var Style = {
  DEFAULT: 'default',
  PRIMARY: 'primary',
  LINK: 'link',
  INVERSE: 'inverse'
};
exports.Style = Style;