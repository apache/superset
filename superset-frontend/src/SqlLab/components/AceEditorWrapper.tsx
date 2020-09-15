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
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';
import ace from 'brace';
import { areArraysShallowEqual } from 'src/reduxUtils';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import {
  SCHEMA_AUTOCOMPLETE_SCORE,
  TABLE_AUTOCOMPLETE_SCORE,
  COLUMN_AUTOCOMPLETE_SCORE,
  SQL_FUNCTIONS_AUTOCOMPLETE_SCORE,
} from 'src/SqlLab/constants';

const langTools = ace.acequire('ace/ext/language_tools');

type HotKey = {
  key: string;
  descr: string;
  name: string;
  func: () => void;
};

interface Props {
  actions: {
    queryEditorSetSelectedText: (edit: any, text: null | string) => void;
    addTable: (queryEditor: any, value: any, schema: any) => void;
  };
  autocomplete: boolean;
  onBlur: (sql: string) => void;
  sql: string;
  schemas: any[];
  tables: any[];
  functionNames: string[];
  extendedTables: Array<{ name: string; columns: any[] }>;
  queryEditor: any;
  height: string;
  hotkeys: HotKey[];
  onChange: (sql: string) => void;
}

interface State {
  sql: string;
  selectedText: string;
  words: any[];
}

class AceEditorWrapper extends React.PureComponent<Props, State> {
  static defaultProps = {
    onBlur: () => {},
    onChange: () => {},
    schemas: [],
    tables: [],
    functionNames: [],
    extendedTables: [],
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      sql: props.sql,
      selectedText: '',
      words: [],
    };
    this.onChange = this.onChange.bind(this);
  }

  componentDidMount() {
    // Making sure no text is selected from previous mount
    this.props.actions.queryEditorSetSelectedText(this.props.queryEditor, null);
    this.setAutoCompleter(this.props);
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (
      !areArraysShallowEqual(this.props.tables, nextProps.tables) ||
      !areArraysShallowEqual(this.props.schemas, nextProps.schemas) ||
      !areArraysShallowEqual(
        this.props.extendedTables,
        nextProps.extendedTables,
      )
    ) {
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

  onEditorLoad(editor: any) {
    editor.commands.addCommand({
      name: 'runQuery',
      bindKey: { win: 'Alt-enter', mac: 'Alt-enter' },
      exec: () => {
        this.onAltEnter();
      },
    });
    this.props.hotkeys.forEach(keyConfig => {
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
      if (
        selectedText !== this.state.selectedText &&
        selectedText.length !== 1
      ) {
        this.setState({ selectedText });
        this.props.actions.queryEditorSetSelectedText(
          this.props.queryEditor,
          selectedText,
        );
      }
    });
  }

  onChange(text: string) {
    this.setState({ sql: text });
    this.props.onChange(text);
  }

  getCompletions(
    aceEditor: any,
    session: any,
    pos: any,
    prefix: string,
    callback: (p0: any, p1: any[]) => void,
  ) {
    // If the prefix starts with a number, don't try to autocomplete with a
    // table name or schema or anything else
    if (!Number.isNaN(parseInt(prefix, 10))) {
      return;
    }
    const completer = {
      insertMatch: (editor: any, data: any) => {
        if (data.meta === 'table') {
          this.props.actions.addTable(
            this.props.queryEditor,
            data.value,
            this.props.queryEditor.schema,
          );
        }
        editor.completer.insertMatch({
          value: `${data.caption}${
            ['function', 'schema'].includes(data.meta) ? '' : ' '
          }`,
        });
      },
    };
    // Mutate instead of object spread here for performance
    const words = this.state.words.map(word => {
      /* eslint-disable-next-line no-param-reassign */
      word.completer = completer;
      return word;
    });
    callback(null, words);
  }

  setAutoCompleter(props: Props) {
    // Loading schema, table and column names as auto-completable words
    const schemas = props.schemas || [];
    const schemaWords = schemas.map(s => ({
      name: s.label,
      value: s.value,
      score: SCHEMA_AUTOCOMPLETE_SCORE,
      meta: 'schema',
    }));
    const columns = {};
    const tables = props.tables || [];
    const extendedTables = props.extendedTables || [];
    const tableWords = tables.map(t => {
      const tableName = t.value;
      const extendedTable = extendedTables.find(et => et.name === tableName);
      const cols = (extendedTable && extendedTable.columns) || [];
      cols.forEach(col => {
        columns[col.name] = null; // using an object as a unique set
      });
      return {
        name: t.label,
        value: tableName,
        score: TABLE_AUTOCOMPLETE_SCORE,
        meta: 'table',
      };
    });

    const columnWords = Object.keys(columns).map(col => ({
      name: col,
      value: col,
      score: COLUMN_AUTOCOMPLETE_SCORE,
      meta: 'column',
    }));

    const functionWords = props.functionNames.map(func => ({
      name: func,
      value: func,
      score: SQL_FUNCTIONS_AUTOCOMPLETE_SCORE,
      meta: 'function',
    }));

    const words = schemaWords
      .concat(tableWords)
      .concat(columnWords)
      .concat(functionWords)
      .concat(sqlKeywords);

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
    const { validationResult } = this.props.queryEditor;
    const resultIsReady = validationResult && validationResult.completed;
    if (resultIsReady && validationResult.errors.length > 0) {
      const errors = validationResult.errors.map((err: any) => ({
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
        enableLiveAutocompletion={this.props.autocomplete}
        value={this.state.sql}
        annotations={this.getAceAnnotations()}
      />
    );
  }
}

export default AceEditorWrapper;
