"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

var _objectWithoutProperties2 = require("babel-runtime/helpers/objectWithoutProperties");

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _defineProperty2 = require("babel-runtime/helpers/defineProperty");

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _extends3 = require("babel-runtime/helpers/extends");

var _extends4 = _interopRequireDefault(_extends3);

var _toConsumableArray2 = require("babel-runtime/helpers/toConsumableArray");

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _getPrototypeOf = require("babel-runtime/core-js/object/get-prototype-of");

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require("babel-runtime/helpers/inherits");

var _inherits3 = _interopRequireDefault(_inherits2);

var _AddButton = require("../AddButton");

var _AddButton2 = _interopRequireDefault(_AddButton);

var _IconButton = require("../IconButton");

var _IconButton2 = _interopRequireDefault(_IconButton);

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _includes = require("core-js/library/fn/array/includes");

var _includes2 = _interopRequireDefault(_includes);

var _types = require("../../types");

var types = _interopRequireWildcard(_types);

var _UnsupportedField = require("./UnsupportedField");

var _UnsupportedField2 = _interopRequireDefault(_UnsupportedField);

var _utils = require("../../utils");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ArrayFieldTitle(_ref) {
  var TitleField = _ref.TitleField,
      idSchema = _ref.idSchema,
      title = _ref.title,
      required = _ref.required;

  if (!title) {
    // See #312: Ensure compatibility with old versions of React.
    return _react2.default.createElement("div", null);
  }
  var id = idSchema.$id + "__title";
  return _react2.default.createElement(TitleField, { id: id, title: title, required: required });
}

function ArrayFieldDescription(_ref2) {
  var DescriptionField = _ref2.DescriptionField,
      idSchema = _ref2.idSchema,
      description = _ref2.description;

  if (!description) {
    // See #312: Ensure compatibility with old versions of React.
    return _react2.default.createElement("div", null);
  }
  var id = idSchema.$id + "__description";
  return _react2.default.createElement(DescriptionField, { id: id, description: description });
}

// Used in the two templates
function DefaultArrayItem(props) {
  var btnStyle = {
    flex: 1,
    paddingLeft: 6,
    paddingRight: 6,
    fontWeight: "bold"
  };
  return _react2.default.createElement(
    "div",
    { key: props.index, className: props.className },
    _react2.default.createElement(
      "div",
      { className: props.hasToolbar ? "col-xs-9" : "col-xs-12" },
      props.children
    ),
    props.hasToolbar && _react2.default.createElement(
      "div",
      { className: "col-xs-3 array-item-toolbox" },
      _react2.default.createElement(
        "div",
        {
          className: "btn-group",
          style: {
            display: "flex",
            justifyContent: "space-around"
          } },
        (props.hasMoveUp || props.hasMoveDown) && _react2.default.createElement(_IconButton2.default, {
          icon: "arrow-up",
          className: "array-item-move-up",
          tabIndex: "-1",
          style: btnStyle,
          disabled: props.disabled || props.readonly || !props.hasMoveUp,
          onClick: props.onReorderClick(props.index, props.index - 1)
        }),
        (props.hasMoveUp || props.hasMoveDown) && _react2.default.createElement(_IconButton2.default, {
          icon: "arrow-down",
          className: "array-item-move-down",
          tabIndex: "-1",
          style: btnStyle,
          disabled: props.disabled || props.readonly || !props.hasMoveDown,
          onClick: props.onReorderClick(props.index, props.index + 1)
        }),
        props.hasRemove && _react2.default.createElement(_IconButton2.default, {
          type: "danger",
          icon: "remove",
          className: "array-item-remove",
          tabIndex: "-1",
          style: btnStyle,
          disabled: props.disabled || props.readonly,
          onClick: props.onDropIndexClick(props.index)
        })
      )
    )
  );
}

function DefaultFixedArrayFieldTemplate(props) {
  return _react2.default.createElement(
    "fieldset",
    { className: props.className, id: props.idSchema.$id },
    _react2.default.createElement(ArrayFieldTitle, {
      key: "array-field-title-" + props.idSchema.$id,
      TitleField: props.TitleField,
      idSchema: props.idSchema,
      title: props.uiSchema["ui:title"] || props.title,
      required: props.required
    }),
    (props.uiSchema["ui:description"] || props.schema.description) && _react2.default.createElement(
      "div",
      {
        className: "field-description",
        key: "field-description-" + props.idSchema.$id },
      props.uiSchema["ui:description"] || props.schema.description
    ),
    _react2.default.createElement(
      "div",
      {
        className: "row array-item-list",
        key: "array-item-list-" + props.idSchema.$id },
      props.items && props.items.map(DefaultArrayItem)
    ),
    props.canAdd && _react2.default.createElement(_AddButton2.default, {
      className: "array-item-add",
      onClick: props.onAddClick,
      disabled: props.disabled || props.readonly
    })
  );
}

function DefaultNormalArrayFieldTemplate(props) {
  return _react2.default.createElement(
    "fieldset",
    { className: props.className, id: props.idSchema.$id },
    _react2.default.createElement(ArrayFieldTitle, {
      key: "array-field-title-" + props.idSchema.$id,
      TitleField: props.TitleField,
      idSchema: props.idSchema,
      title: props.uiSchema["ui:title"] || props.title,
      required: props.required
    }),
    (props.uiSchema["ui:description"] || props.schema.description) && _react2.default.createElement(ArrayFieldDescription, {
      key: "array-field-description-" + props.idSchema.$id,
      DescriptionField: props.DescriptionField,
      idSchema: props.idSchema,
      description: props.uiSchema["ui:description"] || props.schema.description
    }),
    _react2.default.createElement(
      "div",
      {
        className: "row array-item-list",
        key: "array-item-list-" + props.idSchema.$id },
      props.items && props.items.map(function (p) {
        return DefaultArrayItem(p);
      })
    ),
    props.canAdd && _react2.default.createElement(_AddButton2.default, {
      className: "array-item-add",
      onClick: props.onAddClick,
      disabled: props.disabled || props.readonly
    })
  );
}

var ArrayField = function (_Component) {
  (0, _inherits3.default)(ArrayField, _Component);

  function ArrayField() {
    var _ref3;

    var _temp, _this, _ret;

    (0, _classCallCheck3.default)(this, ArrayField);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = (0, _possibleConstructorReturn3.default)(this, (_ref3 = ArrayField.__proto__ || (0, _getPrototypeOf2.default)(ArrayField)).call.apply(_ref3, [this].concat(args))), _this), _this.onAddClick = function (event) {
      event.preventDefault();
      var _this$props = _this.props,
          schema = _this$props.schema,
          formData = _this$props.formData,
          _this$props$registry = _this$props.registry,
          registry = _this$props$registry === undefined ? (0, _utils.getDefaultRegistry)() : _this$props$registry;
      var definitions = registry.definitions;

      var itemSchema = schema.items;
      if ((0, _utils.isFixedItems)(schema) && (0, _utils.allowAdditionalItems)(schema)) {
        itemSchema = schema.additionalItems;
      }
      _this.props.onChange([].concat((0, _toConsumableArray3.default)(formData), [(0, _utils.getDefaultFormState)(itemSchema, undefined, definitions)]));
    }, _this.onDropIndexClick = function (index) {
      return function (event) {
        if (event) {
          event.preventDefault();
        }
        var _this$props2 = _this.props,
            formData = _this$props2.formData,
            onChange = _this$props2.onChange;
        // refs #195: revalidate to ensure properly reindexing errors

        var newErrorSchema = void 0;
        if (_this.props.errorSchema) {
          newErrorSchema = {};
          var errorSchema = _this.props.errorSchema;
          for (var i in errorSchema) {
            i = parseInt(i);
            if (i < index) {
              newErrorSchema[i] = errorSchema[i];
            } else if (i > index) {
              newErrorSchema[i - 1] = errorSchema[i];
            }
          }
        }
        onChange(formData.filter(function (_, i) {
          return i !== index;
        }), newErrorSchema);
      };
    }, _this.onReorderClick = function (index, newIndex) {
      return function (event) {
        if (event) {
          event.preventDefault();
          event.target.blur();
        }
        var _this$props3 = _this.props,
            formData = _this$props3.formData,
            onChange = _this$props3.onChange;

        var newErrorSchema = void 0;
        if (_this.props.errorSchema) {
          newErrorSchema = {};
          var errorSchema = _this.props.errorSchema;
          for (var i in errorSchema) {
            if (i == index) {
              newErrorSchema[newIndex] = errorSchema[index];
            } else if (i == newIndex) {
              newErrorSchema[index] = errorSchema[newIndex];
            } else {
              newErrorSchema[i] = errorSchema[i];
            }
          }
        }

        function reOrderArray() {
          // Copy item
          var newFormData = formData.slice();

          // Moves item from index to newIndex
          newFormData.splice(index, 1);
          newFormData.splice(newIndex, 0, formData[index]);

          return newFormData;
        }

        onChange(reOrderArray(), newErrorSchema);
      };
    }, _this.onChangeForIndex = function (index) {
      return function (value, errorSchema) {
        var _this$props4 = _this.props,
            formData = _this$props4.formData,
            onChange = _this$props4.onChange;

        var newFormData = formData.map(function (item, i) {
          // We need to treat undefined items as nulls to have validation.
          // See https://github.com/tdegrunt/jsonschema/issues/206
          var jsonValue = typeof value === "undefined" ? null : value;
          return index === i ? jsonValue : item;
        });
        onChange(newFormData, errorSchema && _this.props.errorSchema && (0, _extends4.default)({}, _this.props.errorSchema, (0, _defineProperty3.default)({}, index, errorSchema)));
      };
    }, _this.onSelectChange = function (value) {
      _this.props.onChange(value);
    }, _temp), (0, _possibleConstructorReturn3.default)(_this, _ret);
  }

  (0, _createClass3.default)(ArrayField, [{
    key: "isItemRequired",
    value: function isItemRequired(itemSchema) {
      if (Array.isArray(itemSchema.type)) {
        // While we don't yet support composite/nullable jsonschema types, it's
        // future-proof to check for requirement against these.
        return !(0, _includes2.default)(itemSchema.type, "null");
      }
      // All non-null array item types are inherently required by design
      return itemSchema.type !== "null";
    }
  }, {
    key: "canAddItem",
    value: function canAddItem(formItems) {
      var _props = this.props,
          schema = _props.schema,
          uiSchema = _props.uiSchema;

      var _getUiOptions = (0, _utils.getUiOptions)(uiSchema),
          addable = _getUiOptions.addable;

      if (addable !== false) {
        // if ui:options.addable was not explicitly set to false, we can add
        // another item if we have not exceeded maxItems yet
        if (schema.maxItems !== undefined) {
          addable = formItems.length < schema.maxItems;
        } else {
          addable = true;
        }
      }
      return addable;
    }
  }, {
    key: "render",
    value: function render() {
      var _props2 = this.props,
          schema = _props2.schema,
          uiSchema = _props2.uiSchema,
          idSchema = _props2.idSchema,
          _props2$registry = _props2.registry,
          registry = _props2$registry === undefined ? (0, _utils.getDefaultRegistry)() : _props2$registry;
      var definitions = registry.definitions;

      if (!schema.hasOwnProperty("items")) {
        return _react2.default.createElement(_UnsupportedField2.default, {
          schema: schema,
          idSchema: idSchema,
          reason: "Missing items definition"
        });
      }
      if ((0, _utils.isFixedItems)(schema)) {
        return this.renderFixedArray();
      }
      if ((0, _utils.isFilesArray)(schema, uiSchema, definitions)) {
        return this.renderFiles();
      }
      if ((0, _utils.isMultiSelect)(schema, definitions)) {
        return this.renderMultiSelect();
      }
      return this.renderNormalArray();
    }
  }, {
    key: "renderNormalArray",
    value: function renderNormalArray() {
      var _this2 = this;

      var _props3 = this.props,
          schema = _props3.schema,
          uiSchema = _props3.uiSchema,
          formData = _props3.formData,
          errorSchema = _props3.errorSchema,
          idSchema = _props3.idSchema,
          name = _props3.name,
          required = _props3.required,
          disabled = _props3.disabled,
          readonly = _props3.readonly,
          autofocus = _props3.autofocus,
          _props3$registry = _props3.registry,
          registry = _props3$registry === undefined ? (0, _utils.getDefaultRegistry)() : _props3$registry,
          onBlur = _props3.onBlur,
          onFocus = _props3.onFocus,
          idPrefix = _props3.idPrefix,
          rawErrors = _props3.rawErrors;

      var title = schema.title === undefined ? name : schema.title;
      var ArrayFieldTemplate = registry.ArrayFieldTemplate,
          definitions = registry.definitions,
          fields = registry.fields,
          formContext = registry.formContext;
      var TitleField = fields.TitleField,
          DescriptionField = fields.DescriptionField;

      var itemsSchema = (0, _utils.retrieveSchema)(schema.items, definitions);
      var arrayProps = {
        canAdd: this.canAddItem(formData),
        items: formData.map(function (item, index) {
          var itemSchema = (0, _utils.retrieveSchema)(schema.items, definitions, item);
          var itemErrorSchema = errorSchema ? errorSchema[index] : undefined;
          var itemIdPrefix = idSchema.$id + "_" + index;
          var itemIdSchema = (0, _utils.toIdSchema)(itemSchema, itemIdPrefix, definitions, item, idPrefix);
          return _this2.renderArrayFieldItem({
            index: index,
            canMoveUp: index > 0,
            canMoveDown: index < formData.length - 1,
            itemSchema: itemSchema,
            itemIdSchema: itemIdSchema,
            itemErrorSchema: itemErrorSchema,
            itemData: item,
            itemUiSchema: uiSchema.items,
            autofocus: autofocus && index === 0,
            onBlur: onBlur,
            onFocus: onFocus
          });
        }),
        className: "field field-array field-array-of-" + itemsSchema.type,
        DescriptionField: DescriptionField,
        disabled: disabled,
        idSchema: idSchema,
        uiSchema: uiSchema,
        onAddClick: this.onAddClick,
        readonly: readonly,
        required: required,
        schema: schema,
        title: title,
        TitleField: TitleField,
        formContext: formContext,
        formData: formData,
        rawErrors: rawErrors
      };

      // Check if a custom render function was passed in
      var Component = ArrayFieldTemplate || DefaultNormalArrayFieldTemplate;
      return _react2.default.createElement(Component, arrayProps);
    }
  }, {
    key: "renderMultiSelect",
    value: function renderMultiSelect() {
      var _props4 = this.props,
          schema = _props4.schema,
          idSchema = _props4.idSchema,
          uiSchema = _props4.uiSchema,
          formData = _props4.formData,
          disabled = _props4.disabled,
          readonly = _props4.readonly,
          autofocus = _props4.autofocus,
          onBlur = _props4.onBlur,
          onFocus = _props4.onFocus,
          _props4$registry = _props4.registry,
          registry = _props4$registry === undefined ? (0, _utils.getDefaultRegistry)() : _props4$registry,
          rawErrors = _props4.rawErrors;

      var items = this.props.formData;
      var widgets = registry.widgets,
          definitions = registry.definitions,
          formContext = registry.formContext;

      var itemsSchema = (0, _utils.retrieveSchema)(schema.items, definitions, formData);
      var enumOptions = (0, _utils.optionsList)(itemsSchema);

      var _getUiOptions$enumOpt = (0, _extends4.default)({}, (0, _utils.getUiOptions)(uiSchema), {
        enumOptions: enumOptions
      }),
          _getUiOptions$enumOpt2 = _getUiOptions$enumOpt.widget,
          widget = _getUiOptions$enumOpt2 === undefined ? "select" : _getUiOptions$enumOpt2,
          options = (0, _objectWithoutProperties3.default)(_getUiOptions$enumOpt, ["widget"]);

      var Widget = (0, _utils.getWidget)(schema, widget, widgets);
      return _react2.default.createElement(Widget, {
        id: idSchema && idSchema.$id,
        multiple: true,
        onChange: this.onSelectChange,
        onBlur: onBlur,
        onFocus: onFocus,
        options: options,
        schema: schema,
        value: items,
        disabled: disabled,
        readonly: readonly,
        formContext: formContext,
        autofocus: autofocus,
        rawErrors: rawErrors
      });
    }
  }, {
    key: "renderFiles",
    value: function renderFiles() {
      var _props5 = this.props,
          schema = _props5.schema,
          uiSchema = _props5.uiSchema,
          idSchema = _props5.idSchema,
          name = _props5.name,
          disabled = _props5.disabled,
          readonly = _props5.readonly,
          autofocus = _props5.autofocus,
          onBlur = _props5.onBlur,
          onFocus = _props5.onFocus,
          _props5$registry = _props5.registry,
          registry = _props5$registry === undefined ? (0, _utils.getDefaultRegistry)() : _props5$registry,
          rawErrors = _props5.rawErrors;

      var title = schema.title || name;
      var items = this.props.formData;
      var widgets = registry.widgets,
          formContext = registry.formContext;

      var _getUiOptions2 = (0, _utils.getUiOptions)(uiSchema),
          _getUiOptions2$widget = _getUiOptions2.widget,
          widget = _getUiOptions2$widget === undefined ? "files" : _getUiOptions2$widget,
          options = (0, _objectWithoutProperties3.default)(_getUiOptions2, ["widget"]);

      var Widget = (0, _utils.getWidget)(schema, widget, widgets);
      return _react2.default.createElement(Widget, {
        options: options,
        id: idSchema && idSchema.$id,
        multiple: true,
        onChange: this.onSelectChange,
        onBlur: onBlur,
        onFocus: onFocus,
        schema: schema,
        title: title,
        value: items,
        disabled: disabled,
        readonly: readonly,
        formContext: formContext,
        autofocus: autofocus,
        rawErrors: rawErrors
      });
    }
  }, {
    key: "renderFixedArray",
    value: function renderFixedArray() {
      var _this3 = this;

      var _props6 = this.props,
          schema = _props6.schema,
          uiSchema = _props6.uiSchema,
          formData = _props6.formData,
          errorSchema = _props6.errorSchema,
          idPrefix = _props6.idPrefix,
          idSchema = _props6.idSchema,
          name = _props6.name,
          required = _props6.required,
          disabled = _props6.disabled,
          readonly = _props6.readonly,
          autofocus = _props6.autofocus,
          _props6$registry = _props6.registry,
          registry = _props6$registry === undefined ? (0, _utils.getDefaultRegistry)() : _props6$registry,
          onBlur = _props6.onBlur,
          onFocus = _props6.onFocus,
          rawErrors = _props6.rawErrors;

      var title = schema.title || name;
      var items = this.props.formData;
      var ArrayFieldTemplate = registry.ArrayFieldTemplate,
          definitions = registry.definitions,
          fields = registry.fields,
          formContext = registry.formContext;
      var TitleField = fields.TitleField;

      var itemSchemas = schema.items.map(function (item, index) {
        return (0, _utils.retrieveSchema)(item, definitions, formData[index]);
      });
      var additionalSchema = (0, _utils.allowAdditionalItems)(schema) ? (0, _utils.retrieveSchema)(schema.additionalItems, definitions, formData) : null;

      if (!items || items.length < itemSchemas.length) {
        // to make sure at least all fixed items are generated
        items = items || [];
        items = items.concat(new Array(itemSchemas.length - items.length));
      }

      // These are the props passed into the render function
      var arrayProps = {
        canAdd: this.canAddItem(items) && additionalSchema,
        className: "field field-array field-array-fixed-items",
        disabled: disabled,
        idSchema: idSchema,
        formData: formData,
        items: items.map(function (item, index) {
          var additional = index >= itemSchemas.length;
          var itemSchema = additional ? (0, _utils.retrieveSchema)(schema.additionalItems, definitions, item) : itemSchemas[index];
          var itemIdPrefix = idSchema.$id + "_" + index;
          var itemIdSchema = (0, _utils.toIdSchema)(itemSchema, itemIdPrefix, definitions, item, idPrefix);
          var itemUiSchema = additional ? uiSchema.additionalItems || {} : Array.isArray(uiSchema.items) ? uiSchema.items[index] : uiSchema.items || {};
          var itemErrorSchema = errorSchema ? errorSchema[index] : undefined;

          return _this3.renderArrayFieldItem({
            index: index,
            canRemove: additional,
            canMoveUp: index >= itemSchemas.length + 1,
            canMoveDown: additional && index < items.length - 1,
            itemSchema: itemSchema,
            itemData: item,
            itemUiSchema: itemUiSchema,
            itemIdSchema: itemIdSchema,
            itemErrorSchema: itemErrorSchema,
            autofocus: autofocus && index === 0,
            onBlur: onBlur,
            onFocus: onFocus
          });
        }),
        onAddClick: this.onAddClick,
        readonly: readonly,
        required: required,
        schema: schema,
        uiSchema: uiSchema,
        title: title,
        TitleField: TitleField,
        formContext: formContext,
        rawErrors: rawErrors
      };

      // Check if a custom template template was passed in
      var Template = ArrayFieldTemplate || DefaultFixedArrayFieldTemplate;
      return _react2.default.createElement(Template, arrayProps);
    }
  }, {
    key: "renderArrayFieldItem",
    value: function renderArrayFieldItem(props) {
      var index = props.index,
          _props$canRemove = props.canRemove,
          canRemove = _props$canRemove === undefined ? true : _props$canRemove,
          _props$canMoveUp = props.canMoveUp,
          canMoveUp = _props$canMoveUp === undefined ? true : _props$canMoveUp,
          _props$canMoveDown = props.canMoveDown,
          canMoveDown = _props$canMoveDown === undefined ? true : _props$canMoveDown,
          itemSchema = props.itemSchema,
          itemData = props.itemData,
          itemUiSchema = props.itemUiSchema,
          itemIdSchema = props.itemIdSchema,
          itemErrorSchema = props.itemErrorSchema,
          autofocus = props.autofocus,
          onBlur = props.onBlur,
          onFocus = props.onFocus,
          rawErrors = props.rawErrors;
      var _props7 = this.props,
          disabled = _props7.disabled,
          readonly = _props7.readonly,
          uiSchema = _props7.uiSchema,
          _props7$registry = _props7.registry,
          registry = _props7$registry === undefined ? (0, _utils.getDefaultRegistry)() : _props7$registry;
      var SchemaField = registry.fields.SchemaField;

      var _orderable$removable$ = (0, _extends4.default)({
        orderable: true,
        removable: true
      }, uiSchema["ui:options"]),
          orderable = _orderable$removable$.orderable,
          removable = _orderable$removable$.removable;

      var has = {
        moveUp: orderable && canMoveUp,
        moveDown: orderable && canMoveDown,
        remove: removable && canRemove
      };
      has.toolbar = (0, _keys2.default)(has).some(function (key) {
        return has[key];
      });

      return {
        children: _react2.default.createElement(SchemaField, {
          schema: itemSchema,
          uiSchema: itemUiSchema,
          formData: itemData,
          errorSchema: itemErrorSchema,
          idSchema: itemIdSchema,
          required: this.isItemRequired(itemSchema),
          onChange: this.onChangeForIndex(index),
          onBlur: onBlur,
          onFocus: onFocus,
          registry: this.props.registry,
          disabled: this.props.disabled,
          readonly: this.props.readonly,
          autofocus: autofocus,
          rawErrors: rawErrors
        }),
        className: "array-item",
        disabled: disabled,
        hasToolbar: has.toolbar,
        hasMoveUp: has.moveUp,
        hasMoveDown: has.moveDown,
        hasRemove: has.remove,
        index: index,
        onDropIndexClick: this.onDropIndexClick,
        onReorderClick: this.onReorderClick,
        readonly: readonly
      };
    }
  }, {
    key: "itemTitle",
    get: function get() {
      var schema = this.props.schema;

      return schema.items.title || schema.items.description || "Item";
    }
  }]);
  return ArrayField;
}(_react.Component);

ArrayField.defaultProps = {
  uiSchema: {},
  formData: [],
  idSchema: {},
  required: false,
  disabled: false,
  readonly: false,
  autofocus: false
};


if (process.env.NODE_ENV !== "production") {
  ArrayField.propTypes = types.fieldProps;
}

exports.default = ArrayField;