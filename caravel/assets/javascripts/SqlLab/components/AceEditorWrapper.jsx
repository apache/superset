import React from 'react';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';
import ace from 'brace';

const langTools = ace.acequire('ace/ext/language_tools');

const propTypes = {
  onBlur: React.PropTypes.func,
  sql: React.PropTypes.string.isRequired,
  tables: React.PropTypes.array,
};

const defaultProps = {
  onBlur: () => {},
  tables: [],
};

class AceEditorWrapper extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sql: props.sql,
    };
  }
  textChange(text) {
    this.setState({ sql: text });
  }
  onBlur() {
    this.props.onBlur(this.state.sql);
  }
  getCompletions(aceEditor, session, pos, prefix, callback) {
    let words = [];
    const columns = {};
    const tables = this.props.tables || [];
    tables.forEach(t => {
      words.push({ name: t.name, value: t.name, score: 55, meta: 'table' });
      t.columns.forEach(col => {
        columns[col.name] = null;  // using an object as a unique set
      });
    });
    words = words.concat(Object.keys(columns).map(col => (
      { name: col, value: col, score: 50, meta: 'column' }
    )));
    callback(null, words);
  }
  setAutoCompleter() {
    // Loading table and column names as auto-completable words
    const completer = {
      getCompletions: this.getCompletions.bind(this),
    };
    if (langTools) {
      langTools.setCompleters([completer, langTools.keyWordCompleter]);
    }
  }
  render() {
    this.setAutoCompleter();
    return (
      <AceEditor
        mode="sql"
        theme="github"
        onBlur={this.onBlur.bind(this)}
        minLines={8}
        maxLines={30}
        onChange={this.textChange.bind(this)}
        height="200px"
        width="100%"
        editorProps={{ $blockScrolling: true }}
        enableBasicAutocompletion
        value={this.state.sql}
      />
    );
  }
}
AceEditorWrapper.defaultProps = defaultProps;
AceEditorWrapper.propTypes = propTypes;

export default AceEditorWrapper;
