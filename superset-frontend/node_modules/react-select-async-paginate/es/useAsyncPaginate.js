import _objectSpread from "@babel/runtime/helpers/objectSpread2";
import _slicedToArray from "@babel/runtime/helpers/slicedToArray";
import { useState, useCallback } from 'react';
import { useAsyncPaginateBase } from './useAsyncPaginateBase';
export var useAsyncPaginatePure = function useAsyncPaginatePure(useStateParam, useCallbackParam, useAsyncPaginateBaseParam, params) {
  var deps = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];
  var inputValueParam = params.inputValue,
      menuIsOpenParam = params.menuIsOpen,
      onInputChangeParam = params.onInputChange,
      onMenuCloseParam = params.onMenuClose,
      onMenuOpenParam = params.onMenuOpen;

  var _useStateParam = useStateParam(''),
      _useStateParam2 = _slicedToArray(_useStateParam, 2),
      inputValueState = _useStateParam2[0],
      setInputValue = _useStateParam2[1];

  var _useStateParam3 = useStateParam(false),
      _useStateParam4 = _slicedToArray(_useStateParam3, 2),
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
  var baseResult = useAsyncPaginateBaseParam(_objectSpread(_objectSpread({}, params), {}, {
    inputValue: inputValue,
    menuIsOpen: menuIsOpen
  }), deps);
  return _objectSpread(_objectSpread({}, baseResult), {}, {
    inputValue: inputValue,
    menuIsOpen: menuIsOpen,
    onInputChange: onInputChange,
    onMenuClose: onMenuClose,
    onMenuOpen: onMenuOpen
  });
};
export var useAsyncPaginate = function useAsyncPaginate(params) {
  var deps = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  return useAsyncPaginatePure(useState, useCallback, useAsyncPaginateBase, params, deps);
};