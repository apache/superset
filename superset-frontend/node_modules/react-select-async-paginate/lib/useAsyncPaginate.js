"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useAsyncPaginate = exports.useAsyncPaginatePure = void 0;

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));

var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));

var _react = require("react");

var _useAsyncPaginateBase = require("./useAsyncPaginateBase");

var useAsyncPaginatePure = function useAsyncPaginatePure(useStateParam, useCallbackParam, useAsyncPaginateBaseParam, params) {
  var deps = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];
  var inputValueParam = params.inputValue,
      menuIsOpenParam = params.menuIsOpen,
      onInputChangeParam = params.onInputChange,
      onMenuCloseParam = params.onMenuClose,
      onMenuOpenParam = params.onMenuOpen;

  var _useStateParam = useStateParam(''),
      _useStateParam2 = (0, _slicedToArray2["default"])(_useStateParam, 2),
      inputValueState = _useStateParam2[0],
      setInputValue = _useStateParam2[1];

  var _useStateParam3 = useStateParam(false),
      _useStateParam4 = (0, _slicedToArray2["default"])(_useStateParam3, 2),
      menuIsOpenState = _useStateParam4[0],
      setMenuIsOpen = _useStateParam4[1];

  var inputValue = typeof inputValueParam === 'string' ? inputValueParam : inputValueState;
  var menuIsOpen = typeof menuIsOpenParam === 'boolean' ? menuIsOpenParam : menuIsOpenState;
  var onInputChange = useCallbackParam(function (nextInputValue, actionMeta) {
    if (onInputChangeParam) {
      onInputChangeParam(nextInputValue, actionMeta);
    }

    setInputValue(nextInputValue);
  }, [onInputChangeParam]);
  var onMenuClose = useCallbackParam(function () {
    if (onMenuCloseParam) {
      onMenuCloseParam();
    }

    setMenuIsOpen(false);
  }, [onMenuCloseParam]);
  var onMenuOpen = useCallbackParam(function () {
    if (onMenuOpenParam) {
      onMenuOpenParam();
    }

    setMenuIsOpen(true);
  }, [onMenuOpenParam]);
  var baseResult = useAsyncPaginateBaseParam((0, _objectSpread2["default"])((0, _objectSpread2["default"])({}, params), {}, {
    inputValue: inputValue,
    menuIsOpen: menuIsOpen
  }), deps);
  return (0, _objectSpread2["default"])((0, _objectSpread2["default"])({}, baseResult), {}, {
    inputValue: inputValue,
    menuIsOpen: menuIsOpen,
    onInputChange: onInputChange,
    onMenuClose: onMenuClose,
    onMenuOpen: onMenuOpen
  });
};

exports.useAsyncPaginatePure = useAsyncPaginatePure;

var useAsyncPaginate = function useAsyncPaginate(params) {
  var deps = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  return useAsyncPaginatePure(_react.useState, _react.useCallback, _useAsyncPaginateBase.useAsyncPaginateBase, params, deps);
};

exports.useAsyncPaginate = useAsyncPaginate;