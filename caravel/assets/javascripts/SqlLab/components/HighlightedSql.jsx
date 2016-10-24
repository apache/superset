import React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/styles';

const HighlightedSql = (props) => {
  const sql = props.sql || '';
  let lines = sql.split('\n');
  if (lines.length >= props.maxLines) {
    lines = lines.slice(0, props.maxLines);
    lines.push('{...}');
  }
  let shownSql = sql;
  if (props.shrink) {
    shownSql = lines.map((line) => {
      if (line.length > props.maxWidth) {
        return line.slice(0, props.maxWidth) + '{...}';
      }
      return line;
    })
    .join('\n');
  }
  return (
    <div>
      <SyntaxHighlighter language="sql" style={github}>
        {shownSql}
      </SyntaxHighlighter>
    </div>
  );
};

HighlightedSql.defaultProps = {
  maxWidth: 60,
  maxLines: 6,
  shrink: false,
};

HighlightedSql.propTypes = {
  sql: React.PropTypes.string,
  maxWidth: React.PropTypes.number,
  maxLines: React.PropTypes.number,
  shrink: React.PropTypes.bool,
};

export default HighlightedSql;
