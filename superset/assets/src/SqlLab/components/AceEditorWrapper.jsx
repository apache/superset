/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';
import ace from 'brace';
import { areArraysShallowEqual } from '../../reduxUtils';

const langTools = ace.acequire('ace/ext/language_tools');

const keywords = (
  'SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|GROUP|BY|ORDER|LIMIT|OFFSET|HAVING|AS|CASE|' +
  'WHEN|THEN|ELSE|END|TYPE|LEFT|RIGHT|JOIN|ON|OUTER|DESC|ASC|UNION|CREATE|TABLE|PRIMARY|KEY|IF|' +
  'FOREIGN|NOT|REFERENCES|DEFAULT|NULL|INNER|CROSS|NATURAL|DATABASE|DROP|GRANT|SUM|MAX|MIN|COUNT|' +
  'AVG|DISTINCT'
);

const dataTypes = (
  'INT|NUMERIC|DECIMAL|DATE|VARCHAR|CHAR|BIGINT|FLOAT|DOUBLE|BIT|BINARY|TEXT|SET|TIMESTAMP|' +
  'MONEY|REAL|NUMBER|INTEGER'
);

const sqlKeywords = [].concat(keywords.split('|'), dataTypes.split('|'));
export const sqlWords = sqlKeywords.map(s => ({
  name: s, value: s, score: 60, meta: 'sql',
}));

const propTypes = {
  actions: PropTypes.object.isRequired,
  onBlur: PropTypes.func,
  sql: PropTypes.string.isRequired,
  tables: PropTypes.array,
  queryEditor: PropTypes.object.isRequired,
  height: PropTypes.string,
  hotkeys: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    descr: PropTypes.string.isRequired,
    func: PropTypes.func.isRequired,
  })),
  onChange: PropTypes.func,
};

const defaultProps = {
  onBlur: () => {},
  onChange: () => {},
  tables: [],
};

class AceEditorWrapper extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sql: props.sql,
      selectedText: '',
    };
    this.onChange = this.onChange.bind(this);
  }
  componentDidMount() {
    // Making sure no text is selected from previous mount
    this.props.actions.queryEditorSetSelectedText(this.props.queryEditor, null);
    this.setAutoCompleter(this.props);
  }
  componentWillReceiveProps(nextProps) {
    if (!areArraysShallowEqual(this.props.tables, nextProps.tables)) {
      this.setAutoCompleter(nextProps);
    }
    if (nextProps.sql !== this.props.sql) {
      this.setState({ sql: nextProps.sql });
    }
  }
  onBlur() {
    this.props.onBlur(this.state.sql);
  }
  onAltEnter() {
    this.props.onBlur(this.state.sql);
  }
  onEditorLoad(editor) {
    editor.commands.addCommand({
      name: 'runQuery',
      bindKey: { win: 'Alt-enter', mac: 'Alt-enter' },
      exec: () => {
        this.onAltEnter();
      },
    });
    this.props.hotkeys.forEach((keyConfig) => {
      editor.commands.addCommand({
        name: keyConfig.name,
        bindKey: { win: keyConfig.key, mac: keyConfig.key },
        exec: keyConfig.func,
      });
    });
    editor.$blockScrolling = Infinity; // eslint-disable-line no-param-reassign
    editor.selection.on('changeSelection', () => {
      const selectedText = editor.getSelectedText();
      // Backspace trigger 1 character selection, ignoring
      if (selectedText !== this.state.selectedText && selectedText.length !== 1) {
        this.setState({ selectedText });
        this.props.actions.queryEditorSetSelectedText(
          this.props.queryEditor, selectedText);
      }
    });
  }
  onChange(text) {
    this.setState({ sql: text });
    this.props.onChange(text);
  }
  getCompletions(aceEditor, session, pos, prefix, callback) {
    const completer = {
      insertMatch: (editor, data) => {
        editor.completer.insertMatch({ value: data.caption + ' ' });
      },
    };
    const words = this.state.words.map(word => ({ ...word, completer }));
    callback(null, words);
  }
  setAutoCompleter(props) {
    // Loading table and column names as auto-completable words
    let words = [];
    const columns = {};
    const tables = props.tables || [];
    tables.forEach((t) => {
      words.push({ name: t.name, value: t.name, score: 55, meta: 'table' });
      const cols = t.columns || [];
      cols.forEach((col) => {
        columns[col.name] = null;  // using an object as a unique set
      });
    });
    words = words.concat(Object.keys(columns).map(col => (
      { name: col, value: col, score: 50, meta: 'column' }
    )), sqlWords);

    this.setState({ words }, () => {
      const completer = {
        getCompletions: this.getCompletions.bind(this),
      };
      if (langTools) {
        langTools.setCompleters([completer]);
      }
    });
  }
  getAceAnnotations() {
    const validationResult = this.props.queryEditor.validationResult;
    const resultIsReady = (validationResult && validationResult.completed);
    if (resultIsReady && validationResult.errors.length > 0) {
      const errors = validationResult.errors.map(err => ({
        type: 'error',
        row: err.line_number - 1,
        column: err.start_column - 1,
        text: err.message,
      }));
      return errors;
    }
    return [];
  }
  render() {
    return (
      <AceEditor
        mode="sql"
        theme="github"
        onLoad={this.onEditorLoad.bind(this)}
        onBlur={this.onBlur.bind(this)}
        height={this.props.height}
        onChange={this.onChange}
        width="100%"
        editorProps={{ $blockScrolling: true }}
        enableLiveAutocompletion
        value={this.state.sql}
        annotations={this.getAceAnnotations()}
      />
    );
  }
}
AceEditorWrapper.defaultProps = defaultProps;
AceEditorWrapper.propTypes = propTypes;

export default AceEditorWrapper;
