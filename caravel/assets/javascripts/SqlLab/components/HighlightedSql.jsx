import React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/styles';

const defaultProps = {
  maxWidth: 60,
  maxLines: 6,
  shrink: false,
};

const propTypes = {
  sql: React.PropTypes.string,
  maxWidth: React.PropTypes.number,
  maxLines: React.PropTypes.number,
  shrink: React.PropTypes.bool,
};

export default class HighlightedSql extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      extend: false,
    };
  }
  extendSql() {
    this.setState({ extend: !this.state.extend });
  }
  render() {
    const sql = this.props.sql || '';
    let lines = sql.split('\n');
    if (lines.length >= this.props.maxLines && !this.state.extend) {
      lines = lines.slice(0, this.props.maxLines);
      lines.push('{...}');
    }
    let shownSql = sql;
    if (this.props.shrink && !this.state.extend) {
      shownSql = lines.map((line) => {
        if (line.length > this.props.maxWidth) {
          return line.slice(0, this.props.maxWidth) + '{...}';
        }
        return line;
      })
      .join('\n');
    }
    const icon = this.state.extend ? 'minus' : 'plus';
    return (
      <div>
        <SyntaxHighlighter language="sql" style={github}>
          {shownSql}
        </SyntaxHighlighter>
        {this.props.shrink &&
          <span onClick={this.extendSql.bind(this)}>
            <i className={`fa fa-${icon}-circle`} />
          </span>
        }
      </div>
    );
  }
}

HighlightedSql.propTypes = propTypes;
HighlightedSql.defaultProps = defaultProps;
