import React from 'react';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';
import ace from 'brace';
import { areArraysShallowEqual } from '../../reduxUtils';

const langTools = ace.acequire('ace/ext/language_tools');

const keywords = (
  'SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|GROUP|BY|ORDER|LIMIT|OFFSET|HAVING|AS|CASE|' +
  'WHEN|ELSE|END|TYPE|LEFT|RIGHT|JOIN|ON|OUTER|DESC|ASC|UNION|CREATE|TABLE|PRIMARY|KEY|IF|' +
  'FOREIGN|NOT|REFERENCES|DEFAULT|NULL|INNER|CROSS|NATURAL|DATABASE|DROP|GRANT'
);

const dataTypes = (
  'INT|NUMERIC|DECIMAL|DATE|VARCHAR|CHAR|BIGINT|FLOAT|DOUBLE|BIT|BINARY|TEXT|SET|TIMESTAMP|' +
  'MONEY|REAL|NUMBER|INTEGER'
);

const sqlKeywords = [].concat(keywords.split('|'), dataTypes.split('|'));
const sqlWords = sqlKeywords.map(s => ({
  name: s, value: s, score: 60, meta: 'sql',
}));

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  onBlur: React.PropTypes.func,
  onAltEnter: React.PropTypes.func,
  sql: React.PropTypes.string.isRequired,
  tables: React.PropTypes.array,
  queryEditor: React.PropTypes.object.isRequired,
};

const defaultProps = {
  onBlur: () => {},
  onAltEnter: () => {},
  tables: [],
};

class AceEditorWrapper extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sql: props.sql,
    };
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
  textChange(text) {
    this.setState({ sql: text });
  }
  onBlur() {
    this.props.onBlur(this.state.sql);
  }
  getCompletions(aceEditor, session, pos, prefix, callback) {
    callback(null, this.state.words);
  }
  onEditorLoad(editor) {
    editor.commands.addCommand({
      name: 'runQuery',
      bindKey: { win: 'Alt-enter', mac: 'Alt-enter' },
      exec: () => {
        this.props.onAltEnter();
      },
    });
    editor.$blockScrolling = Infinity; // eslint-disable-line no-param-reassign
    editor.selection.on('changeSelection', () => {
      this.props.actions.queryEditorSetSelectedText(
        this.props.queryEditor, editor.getSelectedText());
    });
  }
  setAutoCompleter(props) {
    // Loading table and column names as auto-completable words
    let words = [];
    const columns = {};
    const tables = props.tables || [];
    tables.forEach(t => {
      words.push({ name: t.name, value: t.name, score: 55, meta: 'table' });
      const cols = t.columns || [];
      cols.forEach(col => {
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
  render() {
    return (
      <AceEditor
        mode="sql"
        theme="github"
        onLoad={this.onEditorLoad.bind(this)}
        onBlur={this.onBlur.bind(this)}
        minLines={8}
        maxLines={30}
        onChange={this.textChange.bind(this)}
        height="200px"
        width="100%"
        editorProps={{ $blockScrolling: true }}
        enableLiveAutocompletion
        value={this.state.sql}
      />
    );
  }
}
AceEditorWrapper.defaultProps = defaultProps;
AceEditorWrapper.propTypes = propTypes;

export default AceEditorWrapper;
