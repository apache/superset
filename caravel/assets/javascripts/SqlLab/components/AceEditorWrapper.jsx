import React from 'react';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';

const propTypes = {
  sql: React.PropTypes.string.isRequired,
  onBlur: React.PropTypes.func,
};

const defaultProps = {
  onBlur: () => {},
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

  render() {
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
