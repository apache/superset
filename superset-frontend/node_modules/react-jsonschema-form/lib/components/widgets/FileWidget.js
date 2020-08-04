"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

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

var _promise = require("babel-runtime/core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

var _utils = require("../../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function addNameToDataURL(dataURL, name) {
  return dataURL.replace(";base64", ";name=" + name + ";base64");
}

function processFile(file) {
  var name = file.name,
      size = file.size,
      type = file.type;

  return new _promise2.default(function (resolve, reject) {
    var reader = new window.FileReader();
    reader.onerror = reject;
    reader.onload = function (event) {
      resolve({
        dataURL: addNameToDataURL(event.target.result, name),
        name: name,
        size: size,
        type: type
      });
    };
    reader.readAsDataURL(file);
  });
}

function processFiles(files) {
  return _promise2.default.all([].map.call(files, processFile));
}

function FilesInfo(props) {
  var filesInfo = props.filesInfo;

  if (filesInfo.length === 0) {
    return null;
  }
  return _react2.default.createElement(
    "ul",
    { className: "file-info" },
    filesInfo.map(function (fileInfo, key) {
      var name = fileInfo.name,
          size = fileInfo.size,
          type = fileInfo.type;

      return _react2.default.createElement(
        "li",
        { key: key },
        _react2.default.createElement(
          "strong",
          null,
          name
        ),
        " (",
        type,
        ", ",
        size,
        " bytes)"
      );
    })
  );
}

function extractFileInfo(dataURLs) {
  return dataURLs.filter(function (dataURL) {
    return typeof dataURL !== "undefined";
  }).map(function (dataURL) {
    var _dataURItoBlob = (0, _utils.dataURItoBlob)(dataURL),
        blob = _dataURItoBlob.blob,
        name = _dataURItoBlob.name;

    return {
      name: name,
      size: blob.size,
      type: blob.type
    };
  });
}

var FileWidget = function (_Component) {
  (0, _inherits3.default)(FileWidget, _Component);

  function FileWidget(props) {
    (0, _classCallCheck3.default)(this, FileWidget);

    var _this = (0, _possibleConstructorReturn3.default)(this, (FileWidget.__proto__ || (0, _getPrototypeOf2.default)(FileWidget)).call(this, props));

    _this.onChange = function (event) {
      var _this$props = _this.props,
          multiple = _this$props.multiple,
          onChange = _this$props.onChange;

      processFiles(event.target.files).then(function (filesInfo) {
        var state = {
          values: filesInfo.map(function (fileInfo) {
            return fileInfo.dataURL;
          }),
          filesInfo: filesInfo
        };
        (0, _utils.setState)(_this, state, function () {
          if (multiple) {
            onChange(state.values);
          } else {
            onChange(state.values[0]);
          }
        });
      });
    };

    var value = props.value;

    var values = Array.isArray(value) ? value : [value];
    _this.state = { values: values, filesInfo: extractFileInfo(values) };
    return _this;
  }

  (0, _createClass3.default)(FileWidget, [{
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _utils.shouldRender)(this, nextProps, nextState);
    }
  }, {
    key: "render",
    value: function render() {
      var _this2 = this;

      var _props = this.props,
          multiple = _props.multiple,
          id = _props.id,
          readonly = _props.readonly,
          disabled = _props.disabled,
          autofocus = _props.autofocus;
      var filesInfo = this.state.filesInfo;

      return _react2.default.createElement(
        "div",
        null,
        _react2.default.createElement(
          "p",
          null,
          _react2.default.createElement("input", {
            ref: function ref(_ref) {
              return _this2.inputRef = _ref;
            },
            id: id,
            type: "file",
            disabled: readonly || disabled,
            onChange: this.onChange,
            defaultValue: "",
            autoFocus: autofocus,
            multiple: multiple
          })
        ),
        _react2.default.createElement(FilesInfo, { filesInfo: filesInfo })
      );
    }
  }]);
  return FileWidget;
}(_react.Component);

FileWidget.defaultProps = {
  autofocus: false
};

if (process.env.NODE_ENV !== "production") {
  FileWidget.propTypes = {
    multiple: _propTypes2.default.bool,
    value: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.arrayOf(_propTypes2.default.string)]),
    autofocus: _propTypes2.default.bool
  };
}

exports.default = FileWidget;