'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _brace = require('brace');

var _brace2 = _interopRequireDefault(_brace);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _lodash = require('lodash.isequal');

var _lodash2 = _interopRequireDefault(_lodash);

var _editorOptions = require('./editorOptions.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ace$acequire = _brace2.default.acequire('ace/range'),
    Range = _ace$acequire.Range;

var ReactAce = function (_Component) {
  _inherits(ReactAce, _Component);

  function ReactAce(props) {
    _classCallCheck(this, ReactAce);

    var _this = _possibleConstructorReturn(this, (ReactAce.__proto__ || Object.getPrototypeOf(ReactAce)).call(this, props));

    _editorOptions.editorEvents.forEach(function (method) {
      _this[method] = _this[method].bind(_this);
    });
    return _this;
  }

  _createClass(ReactAce, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      var _this2 = this;

      var _props = this.props,
          className = _props.className,
          onBeforeLoad = _props.onBeforeLoad,
          onValidate = _props.onValidate,
          mode = _props.mode,
          focus = _props.focus,
          theme = _props.theme,
          fontSize = _props.fontSize,
          value = _props.value,
          defaultValue = _props.defaultValue,
          cursorStart = _props.cursorStart,
          showGutter = _props.showGutter,
          wrapEnabled = _props.wrapEnabled,
          showPrintMargin = _props.showPrintMargin,
          _props$scrollMargin = _props.scrollMargin,
          scrollMargin = _props$scrollMargin === undefined ? [0, 0, 0, 0] : _props$scrollMargin,
          keyboardHandler = _props.keyboardHandler,
          onLoad = _props.onLoad,
          commands = _props.commands,
          annotations = _props.annotations,
          markers = _props.markers;


      this.editor = _brace2.default.edit(this.refEditor);

      if (onBeforeLoad) {
        onBeforeLoad(_brace2.default);
      }

      var editorProps = Object.keys(this.props.editorProps);
      for (var i = 0; i < editorProps.length; i++) {
        this.editor[editorProps[i]] = this.props.editorProps[editorProps[i]];
      }
      if (this.props.debounceChangePeriod) {
        this.onChange = this.debounce(this.onChange, this.props.debounceChangePeriod);
      }
      this.editor.renderer.setScrollMargin(scrollMargin[0], scrollMargin[1], scrollMargin[2], scrollMargin[3]);
      this.editor.getSession().setMode('ace/mode/' + mode);
      this.editor.setTheme('ace/theme/' + theme);
      this.editor.setFontSize(fontSize);
      this.editor.getSession().setValue(!defaultValue ? value : defaultValue, cursorStart);
      this.editor.navigateFileEnd();
      this.editor.renderer.setShowGutter(showGutter);
      this.editor.getSession().setUseWrapMode(wrapEnabled);
      this.editor.setShowPrintMargin(showPrintMargin);
      this.editor.on('focus', this.onFocus);
      this.editor.on('blur', this.onBlur);
      this.editor.on('copy', this.onCopy);
      this.editor.on('paste', this.onPaste);
      this.editor.on('change', this.onChange);
      this.editor.on('input', this.onInput);
      this.editor.getSession().selection.on('changeSelection', this.onSelectionChange);
      this.editor.getSession().selection.on('changeCursor', this.onCursorChange);
      if (onValidate) {
        this.editor.getSession().on('changeAnnotation', function () {
          var annotations = _this2.editor.getSession().getAnnotations();
          _this2.props.onValidate(annotations);
        });
      }
      this.editor.session.on('changeScrollTop', this.onScroll);
      this.editor.getSession().setAnnotations(annotations || []);
      if (markers && markers.length > 0) {
        this.handleMarkers(markers);
      }

      // get a list of possible options to avoid 'misspelled option errors'
      var availableOptions = this.editor.$options;
      for (var _i = 0; _i < _editorOptions.editorOptions.length; _i++) {
        var option = _editorOptions.editorOptions[_i];
        if (availableOptions.hasOwnProperty(option)) {
          this.editor.setOption(option, this.props[option]);
        } else if (this.props[option]) {
          console.warn('ReaceAce: editor option ' + option + ' was activated but not found. Did you need to import a related tool or did you possibly mispell the option?');
        }
      }
      this.handleOptions(this.props);

      if (Array.isArray(commands)) {
        commands.forEach(function (command) {
          if (typeof command.exec == 'string') {
            _this2.editor.commands.bindKey(command.bindKey, command.exec);
          } else {
            _this2.editor.commands.addCommand(command);
          }
        });
      }

      if (keyboardHandler) {
        this.editor.setKeyboardHandler('ace/keyboard/' + keyboardHandler);
      }

      if (className) {
        this.refEditor.className += ' ' + className;
      }

      if (focus) {
        this.editor.focus();
      }

      if (onLoad) {
        onLoad(this.editor);
      }

      this.editor.resize();
    }
  }, {
    key: 'debounce',
    value: function debounce(fn, delay) {
      var timer = null;
      return function () {
        var context = this,
            args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () {
          fn.apply(context, args);
        }, delay);
      };
    }
  }, {
    key: 'componentWillReceiveProps',
    value: function componentWillReceiveProps(nextProps) {
      var oldProps = this.props;

      for (var i = 0; i < _editorOptions.editorOptions.length; i++) {
        var option = _editorOptions.editorOptions[i];
        if (nextProps[option] !== oldProps[option]) {
          this.editor.setOption(option, nextProps[option]);
        }
      }

      if (nextProps.className !== oldProps.className) {
        var appliedClasses = this.refEditor.className;
        var appliedClassesArray = appliedClasses.trim().split(' ');
        var oldClassesArray = oldProps.className.trim().split(' ');
        oldClassesArray.forEach(function (oldClass) {
          var index = appliedClassesArray.indexOf(oldClass);
          appliedClassesArray.splice(index, 1);
        });
        this.refEditor.className = ' ' + nextProps.className + ' ' + appliedClassesArray.join(' ');
      }

      if (nextProps.mode !== oldProps.mode) {
        this.editor.getSession().setMode('ace/mode/' + nextProps.mode);
      }
      if (nextProps.theme !== oldProps.theme) {
        this.editor.setTheme('ace/theme/' + nextProps.theme);
      }
      if (nextProps.keyboardHandler !== oldProps.keyboardHandler) {
        if (nextProps.keyboardHandler) {
          this.editor.setKeyboardHandler('ace/keyboard/' + nextProps.keyboardHandler);
        } else {
          this.editor.setKeyboardHandler(null);
        }
      }
      if (nextProps.fontSize !== oldProps.fontSize) {
        this.editor.setFontSize(nextProps.fontSize);
      }
      if (nextProps.wrapEnabled !== oldProps.wrapEnabled) {
        this.editor.getSession().setUseWrapMode(nextProps.wrapEnabled);
      }
      if (nextProps.showPrintMargin !== oldProps.showPrintMargin) {
        this.editor.setShowPrintMargin(nextProps.showPrintMargin);
      }
      if (nextProps.showGutter !== oldProps.showGutter) {
        this.editor.renderer.setShowGutter(nextProps.showGutter);
      }
      if (!(0, _lodash2.default)(nextProps.setOptions, oldProps.setOptions)) {
        this.handleOptions(nextProps);
      }
      if (!(0, _lodash2.default)(nextProps.annotations, oldProps.annotations)) {
        this.editor.getSession().setAnnotations(nextProps.annotations || []);
      }
      if (!(0, _lodash2.default)(nextProps.markers, oldProps.markers) && Array.isArray(nextProps.markers)) {
        this.handleMarkers(nextProps.markers);
      }

      // this doesn't look like it works at all....
      if (!(0, _lodash2.default)(nextProps.scrollMargin, oldProps.scrollMargin)) {
        this.handleScrollMargins(nextProps.scrollMargin);
      }
      if (this.editor && this.editor.getValue() !== nextProps.value) {
        // editor.setValue is a synchronous function call, change event is emitted before setValue return.
        this.silent = true;
        var pos = this.editor.session.selection.toJSON();
        this.editor.setValue(nextProps.value, nextProps.cursorStart);
        this.editor.session.selection.fromJSON(pos);
        this.silent = false;
      }

      if (nextProps.focus && !oldProps.focus) {
        this.editor.focus();
      }
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps) {
      if (prevProps.height !== this.props.height || prevProps.width !== this.props.width) {
        this.editor.resize();
      }
    }
  }, {
    key: 'handleScrollMargins',
    value: function handleScrollMargins() {
      var margins = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [0, 0, 0, 0];

      this.editor.renderer.setScrollMargins(margins[0], margins[1], margins[2], margins[3]);
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      this.editor.destroy();
      this.editor = null;
    }
  }, {
    key: 'onChange',
    value: function onChange(event) {
      if (this.props.onChange && !this.silent) {
        var value = this.editor.getValue();
        this.props.onChange(value, event);
      }
    }
  }, {
    key: 'onSelectionChange',
    value: function onSelectionChange(event) {
      if (this.props.onSelectionChange) {
        var value = this.editor.getSelection();
        this.props.onSelectionChange(value, event);
      }
    }
  }, {
    key: 'onCursorChange',
    value: function onCursorChange(event) {
      if (this.props.onCursorChange) {
        var value = this.editor.getSelection();
        this.props.onCursorChange(value, event);
      }
    }
  }, {
    key: 'onInput',
    value: function onInput(event) {
      if (this.props.onInput) {
        this.props.onInput(event);
      }
    }
  }, {
    key: 'onFocus',
    value: function onFocus(event) {
      if (this.props.onFocus) {
        this.props.onFocus(event);
      }
    }
  }, {
    key: 'onBlur',
    value: function onBlur(event) {
      if (this.props.onBlur) {
        this.props.onBlur(event, this.editor);
      }
    }
  }, {
    key: 'onCopy',
    value: function onCopy(text) {
      if (this.props.onCopy) {
        this.props.onCopy(text);
      }
    }
  }, {
    key: 'onPaste',
    value: function onPaste(text) {
      if (this.props.onPaste) {
        this.props.onPaste(text);
      }
    }
  }, {
    key: 'onScroll',
    value: function onScroll() {
      if (this.props.onScroll) {
        this.props.onScroll(this.editor);
      }
    }
  }, {
    key: 'handleOptions',
    value: function handleOptions(props) {
      var setOptions = Object.keys(props.setOptions);
      for (var y = 0; y < setOptions.length; y++) {
        this.editor.setOption(setOptions[y], props.setOptions[setOptions[y]]);
      }
    }
  }, {
    key: 'handleMarkers',
    value: function handleMarkers(markers) {
      var _this3 = this;

      // remove foreground markers
      var currentMarkers = this.editor.getSession().getMarkers(true);
      for (var i in currentMarkers) {
        if (currentMarkers.hasOwnProperty(i)) {
          this.editor.getSession().removeMarker(currentMarkers[i].id);
        }
      }
      // remove background markers
      currentMarkers = this.editor.getSession().getMarkers(false);
      for (var _i2 in currentMarkers) {
        if (currentMarkers.hasOwnProperty(_i2)) {
          this.editor.getSession().removeMarker(currentMarkers[_i2].id);
        }
      }
      // add new markers
      markers.forEach(function (_ref) {
        var startRow = _ref.startRow,
            startCol = _ref.startCol,
            endRow = _ref.endRow,
            endCol = _ref.endCol,
            className = _ref.className,
            type = _ref.type,
            _ref$inFront = _ref.inFront,
            inFront = _ref$inFront === undefined ? false : _ref$inFront;

        var range = new Range(startRow, startCol, endRow, endCol);
        _this3.editor.getSession().addMarker(range, className, type, inFront);
      });
    }
  }, {
    key: 'updateRef',
    value: function updateRef(item) {
      this.refEditor = item;
    }
  }, {
    key: 'render',
    value: function render() {
      var _props2 = this.props,
          name = _props2.name,
          width = _props2.width,
          height = _props2.height,
          style = _props2.style;

      var divStyle = _extends({ width: width, height: height }, style);
      return _react2.default.createElement('div', { ref: this.updateRef,
        id: name,
        style: divStyle
      });
    }
  }]);

  return ReactAce;
}(_react.Component);

exports.default = ReactAce;


ReactAce.propTypes = {
  mode: _propTypes2.default.string,
  focus: _propTypes2.default.bool,
  theme: _propTypes2.default.string,
  name: _propTypes2.default.string,
  className: _propTypes2.default.string,
  height: _propTypes2.default.string,
  width: _propTypes2.default.string,
  fontSize: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.string]),
  showGutter: _propTypes2.default.bool,
  onChange: _propTypes2.default.func,
  onCopy: _propTypes2.default.func,
  onPaste: _propTypes2.default.func,
  onFocus: _propTypes2.default.func,
  onInput: _propTypes2.default.func,
  onBlur: _propTypes2.default.func,
  onScroll: _propTypes2.default.func,
  value: _propTypes2.default.string,
  defaultValue: _propTypes2.default.string,
  onLoad: _propTypes2.default.func,
  onSelectionChange: _propTypes2.default.func,
  onCursorChange: _propTypes2.default.func,
  onBeforeLoad: _propTypes2.default.func,
  onValidate: _propTypes2.default.func,
  minLines: _propTypes2.default.number,
  maxLines: _propTypes2.default.number,
  readOnly: _propTypes2.default.bool,
  highlightActiveLine: _propTypes2.default.bool,
  tabSize: _propTypes2.default.number,
  showPrintMargin: _propTypes2.default.bool,
  cursorStart: _propTypes2.default.number,
  debounceChangePeriod: _propTypes2.default.number,
  editorProps: _propTypes2.default.object,
  setOptions: _propTypes2.default.object,
  style: _propTypes2.default.object,
  scrollMargin: _propTypes2.default.array,
  annotations: _propTypes2.default.array,
  markers: _propTypes2.default.array,
  keyboardHandler: _propTypes2.default.string,
  wrapEnabled: _propTypes2.default.bool,
  enableBasicAutocompletion: _propTypes2.default.oneOfType([_propTypes2.default.bool, _propTypes2.default.array]),
  enableLiveAutocompletion: _propTypes2.default.oneOfType([_propTypes2.default.bool, _propTypes2.default.array]),
  commands: _propTypes2.default.array
};

ReactAce.defaultProps = {
  name: 'brace-editor',
  focus: false,
  mode: '',
  theme: '',
  height: '500px',
  width: '500px',
  value: '',
  fontSize: 12,
  showGutter: true,
  onChange: null,
  onPaste: null,
  onLoad: null,
  onScroll: null,
  minLines: null,
  maxLines: null,
  readOnly: false,
  highlightActiveLine: true,
  showPrintMargin: true,
  tabSize: 4,
  cursorStart: 1,
  editorProps: {},
  style: {},
  scrollMargin: [0, 0, 0, 0],
  setOptions: {},
  wrapEnabled: false,
  enableBasicAutocompletion: false,
  enableLiveAutocompletion: false
};