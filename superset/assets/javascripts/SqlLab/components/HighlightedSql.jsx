import React from 'react';
import PropTypes from 'prop-types';

import SyntaxHighlighter, { registerLanguage } from 'react-syntax-highlighter/dist/light';
import sql from 'react-syntax-highlighter/dist/languages/sql';
import github from 'react-syntax-highlighter/dist/styles/github';

import ModalTrigger from '../../components/ModalTrigger';

registerLanguage('sql', sql);

const defaultProps = {
  maxWidth: 50,
  maxLines: 5,
  shrink: false,
};

const propTypes = {
  sql: PropTypes.string.isRequired,
  rawSql: PropTypes.string,
  maxWidth: PropTypes.number,
  maxLines: PropTypes.number,
  shrink: PropTypes.bool,
};

class HighlightedSql extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      modalBody: null,
    };
  }
  shrinkSql() {
    const ssql = this.props.sql || '';
    let lines = ssql.split('\n');
    if (lines.length >= this.props.maxLines) {
      lines = lines.slice(0, this.props.maxLines);
      lines.push('{...}');
    }
    return lines.map((line) => {
      if (line.length > this.props.maxWidth) {
        return line.slice(0, this.props.maxWidth) + '{...}';
      }
      return line;
    })
    .join('\n');
  }
  triggerNode() {
    const shownSql = this.props.shrink ? this.shrinkSql(this.props.sql) : this.props.sql;
    return (
      <SyntaxHighlighter language="sql" style={github}>
        {shownSql}
      </SyntaxHighlighter>);
  }
  generateModal() {
    let rawSql;
    if (this.props.rawSql && this.props.rawSql !== this.props.sql) {
      rawSql = (
        <div>
          <h4>Raw SQL</h4>
          <SyntaxHighlighter language="sql" style={github}>
            {this.props.rawSql}
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
