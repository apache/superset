import _toConsumableArray from "@babel/runtime/helpers/toConsumableArray";
export var defaultReduceOptions = function defaultReduceOptions(prevOptions, loadedOptions) {
  return [].concat(_toConsumableArray(prevOptions), _toConsumableArray(loadedOptions));
};