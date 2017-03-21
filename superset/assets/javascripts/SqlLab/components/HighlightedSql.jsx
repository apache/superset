import React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/styles';
import ModalTrigger from '../../components/ModalTrigger';

const defaultProps = {
  maxWidth: 50,
  maxLines: 5,
  shrink: false,
};

const propTypes = {
  sql: React.PropTypes.string.isRequired,
  rawSql: React.PropTypes.string,
  maxWidth: React.PropTypes.number,
  maxLines: React.PropTypes.number,
  shrink: React.PropTypes.bool,
};

class HighlightedSql extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      modalBody: null,
    };
  }
  shrinkSql() {
    const props = this.props;
    const sql = props.sql || '';
    let lines = sql.split('\n');
    if (lines.length >= props.maxLines) {
      lines = lines.slice(0, props.maxLines);
      lines.push('{...}');
    }
    return lines.map((line) => {
      if (line.length > props.maxWidth) {
        return line.slice(0, props.maxWidth) + '{...}';
      }
      return line;
    })
    .join('\n');
  }
  triggerNode() {
    const props = this.props;
    let shownSql = props.shrink ? this.shrinkSql(props.sql) : props.sql;
    return (
      <SyntaxHighlighter language="sql" style={github}>
        {shownSql}
      </SyntaxHighlighter>);
  }
  generateModal() {
    const props = this.props;
    let rawSql;
    if (props.rawSql && props.rawSql !== this.props.sql) {
      rawSql = (
        <div>
          <h4>Raw SQL</h4>
          <SyntaxHighlighter language="sql" style={github}>
            {props.rawSql}
          </SyntaxHighlighter>
        </div>
      );
    }
    this.setState({
      modalBody: (
        <div>
          <h4>Source SQL</h4>
          <SyntaxHighlighter language="sql" style={github}>
            {this.props.sql}
          </SyntaxHighlighter>
          {rawSql}
        </div>
      ),
    });
  }
  render() {
    return (
      <ModalTrigger
        modalTitle="SQL"
        triggerNode={this.triggerNode()}
        modalBody={this.state.modalBody}
        beforeOpen={this.generateModal.bind(this)}
      />
    );
  }
}
HighlightedSql.propTypes = propTypes;
HighlightedSql.defaultProps = defaultProps;

export default HighlightedSql;
