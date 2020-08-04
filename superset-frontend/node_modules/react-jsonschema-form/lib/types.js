"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fieldProps = exports.registry = undefined;

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var registry = exports.registry = _propTypes2.default.shape({
  ArrayFieldTemplate: _propTypes2.default.func,
  FieldTemplate: _propTypes2.default.func,
  ObjectFieldTemplate: _propTypes2.default.func,
  definitions: _propTypes2.default.object.isRequired,
  fields: _propTypes2.default.objectOf(_propTypes2.default.func).isRequired,
  formContext: _propTypes2.default.object.isRequired,
  widgets: _propTypes2.default.objectOf(_propTypes2.default.oneOfType([_propTypes2.default.func, _propTypes2.default.object])).isRequired
});

var fieldProps = exports.fieldProps = {
  autofocus: _propTypes2.default.bool,
  disabled: _propTypes2.default.bool,
  errorSchema: _propTypes2.default.object,
  formData: _propTypes2.default.any,
  idSchema: _propTypes2.default.object,
  onBlur: _propTypes2.default.func,
  onChange: _propTypes2.default.func.isRequired,
  onFocus: _propTypes2.default.func,
  rawErrors: _propTypes2.default.arrayOf(_propTypes2.default.string),
  readonly: _propTypes2.default.bool,
  registry: registry.isRequired,
  required: _propTypes2.default.bool,
  schema: _propTypes2.default.object.isRequired,
  uiSchema: _propTypes2.default.shape({
    "ui:options": _propTypes2.default.shape({
      addable: _propTypes2.default.bool,
      orderable: _propTypes2.default.bool,
      removable: _propTypes2.default.bool
    })
  })
};