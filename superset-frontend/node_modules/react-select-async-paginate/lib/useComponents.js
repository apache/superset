"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useComponents = exports.useComponentsPure = exports.MenuList = void 0;

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));

var _react = require("react");

var _reactSelect = require("react-select");

var _wrapMenuList = require("./wrapMenuList");

var MenuList = (0, _wrapMenuList.wrapMenuList)(_reactSelect.components.MenuList);
exports.MenuList = MenuList;

var useComponentsPure = function useComponentsPure(useMemoParam, components) {
  return useMemoParam(function () {
    return (0, _objectSpread2["default"])({
      MenuList: MenuList
    }, components);
  }, [components]);
};

exports.useComponentsPure = useComponentsPure;

var useComponents = function useComponents(components) {
  return useComponentsPure(_react.useMemo, components);
};

exports.useComponents = useComponents;