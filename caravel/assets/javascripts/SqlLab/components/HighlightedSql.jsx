import React from 'react';
import { Well } from 'react-bootstrap';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/styles';
import ModalTrigger from '../../components/ModalTrigger'

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
    <ModalTrigger
      modalTitle="SQL"
      triggerNode={
        <Well>
          <SyntaxHighlighter language="sql" style={github}>
            {shownSql}
          </SyntaxHighlighter>
        </Well>
      }
      modalBody={
        <div>
          <h4>Source SQL</h4>
          <SyntaxHighlighter language="sql" style={github}>
            {props.sql}
          </SyntaxHighlighter>
          {props.rawSql &&
            <div>
              <h4>Raw SQL</h4>
              <SyntaxHighlighter language="sql" style={github}>
                {props.rawSql}
              </SyntaxHighlighter>
            </div>
          }
        </div>
      }
    />
  );
};
HighlightedSql.propTypes = propTypes;
HighlightedSql.defaultProps = defaultProps;

export default HighlightedSql;
