(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};


















import { Slider, InputNumber, Input } from 'antd';
import Checkbox from 'antd/lib/checkbox';
import Select from '../Select';
import RadioButtonControl from

'../../shared-controls/components/RadioButtonControl';

export const ControlFormItemComponents = {
  Slider,
  InputNumber,
  Input,
  Select,
  // Directly export Checkbox will result in "using name from external module" error
  // ref: https://stackoverflow.com/questions/43900035/ts4023-exported-variable-x-has-or-is-using-name-y-from-external-module-but
  Checkbox: Checkbox,


  RadioButtonControl };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ControlFormItemComponents, "ControlFormItemComponents", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ControlForm/controls.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();