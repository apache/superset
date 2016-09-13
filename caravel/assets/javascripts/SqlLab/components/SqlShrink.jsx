import React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/styles';

const SqlShrink = (props) => {
  const sql = props.sql || '';
  let lines = sql.split('\n');
  if (lines.length >= props.maxLines) {
    lines = lines.slice(0, props.maxLines);
    lines.push('{...}');
  }
  const shrunk = lines.map((line) => {
    if (line.length > props.maxWidth) {
      return line.slice(0, props.maxWidth) + '{...}';
    }
    return line;
  })
  .join('\n');
  return (
    <div>
      <SyntaxHighlighter language="sql" style={github}>
        {shrunk}
      </SyntaxHighlighter>
    </div>
  );
};

SqlShrink.defaultProps = {
  maxWidth: 60,
  maxLines: 6,
};

SqlShrink.propTypes = {
  sql: React.PropTypes.string,
  maxWidth: React.PropTypes.number,
  maxLines: React.PropTypes.number,
};

export default SqlShrink;
