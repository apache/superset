import _objectSpread from "@babel/runtime/helpers/objectSpread2";
import { useMemo } from 'react';
import { components as defaultComponents } from 'react-select';
import { wrapMenuList } from './wrapMenuList';
export var MenuList = wrapMenuList(defaultComponents.MenuList);
export var useComponentsPure = function useComponentsPure(useMemoParam, components) {
  return useMemoParam(function () {
    return _objectSpread({
      MenuList: MenuList
    }, components);
  }, [components]);
};
export var useComponents = function useComponents(components) {
  return useComponentsPure(useMemo, components);
};