import ace from 'brace'
import {UndoManager} from 'brace';
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import isEqual from 'lodash.isequal'
import get from 'lodash.get'

import { editorOptions, editorEvents } from './editorOptions.js'
const { Range } = ace.acequire('ace/range');

import 'brace/ext/split'
const { Split } = ace.acequire('ace/split');

export default class SplitComponent extends Component {
  constructor(props) {
    super(props);
    editorEvents.forEach(method => {
      this[method] = this[method].bind(this);
    });
  }

  componentDidMount() {
    const {
      className,
      onBeforeLoad,
      mode,
      focus,
      theme,
      fontSize,
      value,
      defaultValue,
      cursorStart,
      showGutter,
      wrapEnabled,
      showPrintMargin,
      scrollMargin = [ 0, 0, 0, 0],
      keyboardHandler,
      onLoad,
      commands,
      annotations,
      markers,
      splits,
    } = this.props;

    this.editor = ace.edit(this.refEditor);

    if (onBeforeLoad) {
      onBeforeLoad(ace);
    }

    const editorProps = Object.keys(this.props.editorProps);

    var split = new Split(this.editor.container,`ace/theme/${theme}`,splits)
    this.editor.env.split = split;

    this.splitEditor = split.getEditor(0);
    this.split = split
    // in a split scenario we don't want a print margin for the entire application
    this.editor.setShowPrintMargin(false);
    this.editor.renderer.setShowGutter(false);
    // get a list of possible options to avoid 'misspelled option errors'
    const availableOptions = this.splitEditor.$options;
    split.forEach((editor, index) => {
      for (let i = 0; i < editorProps.length; i++) {
        editor[editorProps[i]] = this.props.editorProps[editorProps[i]];
      }
      const defaultValueForEditor = get(defaultValue, index)
      const valueForEditor = get(value, index, '')
      editor.session.setUndoManager(new UndoManager());
      editor.setTheme(`ace/theme/${theme}`);
      editor.renderer.setScrollMargin(scrollMargin[0], scrollMargin[1], scrollMargin[2], scrollMargin[3])
      editor.getSession().setMode(`ace/mode/${mode}`);
      editor.setFontSize(fontSize);
      editor.renderer.setShowGutter(showGutter);
      editor.getSession().setUseWrapMode(wrapEnabled);
      editor.setShowPrintMargin(showPrintMargin);
      editor.on('focus', this.onFocus);
      editor.on('blur', this.onBlur);
      editor.on('input', this.onInput);
      editor.on('copy', this.onCopy);
      editor.on('paste', this.onPaste);
      editor.on('change', this.onChange);
      editor.getSession().selection.on('changeSelection', this.onSelectionChange);
      editor.getSession().selection.on('changeCursor', this.onCursorChange);
      editor.session.on('changeScrollTop', this.onScroll);
      editor.setValue(defaultValueForEditor === undefined ? valueForEditor : defaultValueForEditor, cursorStart);
      const newAnnotations = get(annotations, index, [])
      const newMarkers = get(markers, index, [])
      editor.getSession().setAnnotations(newAnnotations);
      if(newMarkers && newMarkers.length > 0){
        this.handleMarkers(newMarkers,editor);
      }

      for (let i = 0; i < editorOptions.length; i++) {
        const option = editorOptions[i];
        if (availableOptions.hasOwnProperty(option)) {
          editor.setOption(option, this.props[option]);
        } else if (this.props[option]) {
          console.warn(`ReaceAce: editor option ${option} was activated but not found. Did you need to import a related tool or did you possibly mispell the option?`)
        }
      }
      this.handleOptions(this.props, editor);

      if (Array.isArray(commands)) {
        commands.forEach((command) => {
          if(typeof command.exec == 'string') {
            editor.commands.bindKey(command.bindKey, command.exec);
          }
          else {
            editor.commands.addCommand(command);
          }
        });
      }

      if (keyboardHandler) {
        editor.setKeyboardHandler('ace/keyboard/' + keyboardHandler);
      }
    })

    if (className) {
      this.refEditor.className += ' ' + className;
    }

    if (focus) {
      this.splitEditor.focus();
    }

    const sp = this.editor.env.split;
    sp.setOrientation( this.props.orientation === 'below' ? sp.BELOW : sp.BESIDE);
    sp.resize(true)
    if (onLoad) {
      onLoad(sp);
    }
  }

  componentWillReceiveProps(nextProps) {
    const oldProps = this.props;

    const split = this.editor.env.split

    if (nextProps.splits !== oldProps.splits) {
      split.setSplits(nextProps.splits)
    }

    if (nextProps.orientation !== oldProps.orientation) {
      split.setOrientation( nextProps.orientation === 'below' ? split.BELOW : split.BESIDE);
    }

    split.forEach((editor, index) => {

      if (nextProps.mode !== oldProps.mode) {
        editor.getSession().setMode('ace/mode/' + nextProps.mode);
      }
      if (nextProps.keyboardHandler !== oldProps.keyboardHandler) {
        if (nextProps.keyboardHandler) {
          editor.setKeyboardHandler('ace/keyboard/' + nextProps.keyboardHandler);
        } else {
          editor.setKeyboardHandler(null);
        }
      }
      if (nextProps.fontSize !== oldProps.fontSize) {
        editor.setFontSize(nextProps.fontSize);
      }
      if (nextProps.wrapEnabled !== oldProps.wrapEnabled) {
        editor.getSession().setUseWrapMode(nextProps.wrapEnabled);
      }
      if (nextProps.showPrintMargin !== oldProps.showPrintMargin) {
        editor.setShowPrintMargin(nextProps.showPrintMargin);
      }
      if (nextProps.showGutter !== oldProps.showGutter) {
        editor.renderer.setShowGutter(nextProps.showGutter);
      }

      for (let i = 0; i < editorOptions.length; i++) {
        const option = editorOptions[i];
        if (nextProps[option] !== oldProps[option]) {
          editor.setOption(option, nextProps[option]);
        }
      }
      if (!isEqual(nextProps.setOptions, oldProps.setOptions)) {
        this.handleOptions(nextProps, editor);
      }
      const nextValue = get(nextProps.value, index, '')
      if (editor.getValue() !== nextValue) {
        // editor.setValue is a synchronous function call, change event is emitted before setValue return.
        this.silent = true;
        const pos = editor.session.selection.toJSON();
        editor.setValue(nextValue, nextProps.cursorStart);
        editor.session.selection.fromJSON(pos);
        this.silent = false;
      }
      const newAnnotations = get(nextProps.annotations, index, [])
      const oldAnnotations = get(oldProps.annotations, index, [])
      if (!isEqual(newAnnotations, oldAnnotations)) {
        editor.getSession().setAnnotations(newAnnotations);
      }

      const newMarkers = get(nextProps.markers, index, [])
      const oldMarkers = get(oldProps.markers, index, [])
      if (!isEqual(newMarkers, oldMarkers) && Array.isArray(newMarkers)) {
        this.handleMarkers(newMarkers, editor);
      }

    })

    if (nextProps.className !== oldProps.className) {
      let appliedClasses = this.refEditor.className;
      let appliedClassesArray = appliedClasses.trim().split(' ');
      let oldClassesArray = oldProps.className.trim().split(' ');
      oldClassesArray.forEach((oldClass) => {
        let index = appliedClassesArray.indexOf(oldClass);
        appliedClassesArray.splice(index, 1);
      });
      this.refEditor.className = ' ' + nextProps.className + ' ' + appliedClassesArray.join(' ');
    }

    if (nextProps.theme !== oldProps.theme) {
      split.setTheme('ace/theme/' + nextProps.theme);
    }

    if (nextProps.focus && !oldProps.focus) {
      this.splitEditor.focus();
    }
    if(nextProps.height !== this.props.height || nextProps.width !== this.props.width){
      this.editor.resize();
    }
  }

  componentWillUnmount() {
    this.editor.destroy();
    this.editor = null;
  }

  onChange(event) {
    if (this.props.onChange && !this.silent) {
      let value = []
      this.editor.env.split.forEach((editor) => {
        value.push(editor.getValue())
      })
      this.props.onChange(value, event);
    }
  }

  onSelectionChange(event) {
    if (this.props.onSelectionChange) {
      let value = []
      this.editor.env.split.forEach((editor) => {
        value.push(editor.getSelection())
      })
      this.props.onSelectionChange(value, event);
    }
  }
  onCursorChange(event) {
    if(this.props.onCursorChange) {
      let value = []
      this.editor.env.split.forEach((editor) => {
        value.push(editor.getSelection())
      })
      this.props.onCursorChange(value, event)
    }
  }
  onFocus(event) {
    if (this.props.onFocus) {
      this.props.onFocus(event);
    }
  }

  onInput(event) {
    if (this.props.onInput) {
      this.props.onInput(event);
    }
  }

  onBlur(event) {
    if (this.props.onBlur) {
      this.props.onBlur(event);
    }
  }

  onCopy(text) {
    if (this.props.onCopy) {
      this.props.onCopy(text);
    }
  }

  onPaste(text) {
    if (this.props.onPaste) {
      this.props.onPaste(text);
    }
  }

  onScroll() {
    if (this.props.onScroll) {
      this.props.onScroll(this.editor);
    }
  }

  handleOptions(props, editor) {
    const setOptions = Object.keys(props.setOptions);
    for (let y = 0; y < setOptions.length; y++) {
      editor.setOption(setOptions[y], props.setOptions[setOptions[y]]);
    }
  }

  handleMarkers(markers, editor) {
    // remove foreground markers
    let currentMarkers = editor.getSession().getMarkers(true);
    for (const i in currentMarkers) {
      if (currentMarkers.hasOwnProperty(i)) {
        editor.getSession().removeMarker(currentMarkers[i].id);
      }
    }
    // remove background markers
    currentMarkers = editor.getSession().getMarkers(false);
    for (const i in currentMarkers) {
      if (currentMarkers.hasOwnProperty(i)) {
        editor.getSession().removeMarker(currentMarkers[i].id);
      }
    }
    // add new markers
    markers.forEach(({ startRow, startCol, endRow, endCol, className, type, inFront = false }) => {
      const range = new Range(startRow, startCol, endRow, endCol);
      editor.getSession().addMarker(range, className, type, inFront);
    });
  }

  updateRef(item) {
    this.refEditor = item;
  }

  render() {
    const { name, width, height, style } = this.props;
    const divStyle = { width, height, ...style };
    return (
      <div ref={this.updateRef}
        id={name}
        style={divStyle}
      >
      </div>
    );
  }
}

SplitComponent.propTypes = {
  mode: PropTypes.string,
  splits: PropTypes.number,
  orientation: PropTypes.string,
  focus: PropTypes.bool,
  theme: PropTypes.string,
  name: PropTypes.string,
  className: PropTypes.string,
  height: PropTypes.string,
  width: PropTypes.string,
  fontSize: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
  showGutter: PropTypes.bool,
  onChange: PropTypes.func,
  onCopy: PropTypes.func,
  onPaste: PropTypes.func,
  onFocus: PropTypes.func,
  onInput: PropTypes.func,
  onBlur: PropTypes.func,
  onScroll: PropTypes.func,
  value: PropTypes.arrayOf(PropTypes.string),
  defaultValue: PropTypes.arrayOf(PropTypes.string),
  onLoad: PropTypes.func,
  onSelectionChange: PropTypes.func,
  onCursorChange: PropTypes.func,
  onBeforeLoad: PropTypes.func,
  minLines: PropTypes.number,
  maxLines: PropTypes.number,
  readOnly: PropTypes.bool,
  highlightActiveLine: PropTypes.bool,
  tabSize: PropTypes.number,
  showPrintMargin: PropTypes.bool,
  cursorStart: PropTypes.number,
  editorProps: PropTypes.object,
  setOptions: PropTypes.object,
  style: PropTypes.object,
  scrollMargin: PropTypes.array,
  annotations: PropTypes.array,
  markers: PropTypes.array,
  keyboardHandler: PropTypes.string,
  wrapEnabled: PropTypes.bool,
  enableBasicAutocompletion: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.array,
  ]),
  enableLiveAutocompletion: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.array,
  ]),
  commands: PropTypes.array,
};

SplitComponent.defaultProps = {
  name: 'brace-editor',
  focus: false,
  orientation: 'beside',
  splits: 2,
  mode: '',
  theme: '',
  height: '500px',
  width: '500px',
  value: [],
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
  scrollMargin: [ 0, 0, 0, 0],
  setOptions: {},
  wrapEnabled: false,
  enableBasicAutocompletion: false,
  enableLiveAutocompletion: false,
};