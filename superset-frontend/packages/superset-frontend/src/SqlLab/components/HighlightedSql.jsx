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
import PropTypes from 'prop-types';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { t } from '@superset-ui/core';

import ModalTrigger from '../../components/ModalTrigger';

SyntaxHighlighter.registerLanguage('sql', sql);

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
    return lines
      .map(line => {
        if (line.length > this.props.maxWidth) {
          return `${line.slice(0, this.props.maxWidth)}{...}`;
        }
        return line;
      })
      .join('\n');
  }

  triggerNode() {
    const shownSql = this.props.shrink
      ? this.shrinkSql(this.props.sql)
      : this.props.sql;
    return (
      <SyntaxHighlighter language="sql" style={github}>
        {shownSql}
      </SyntaxHighlighter>
    );
  }

  generateModal() {
    let rawSql;
    if (this.props.rawSql && this.props.rawSql !== this.props.sql) {
      rawSql = (
        <div>
          <h4>{t('Raw SQL')}</h4>
          <SyntaxHighlighter language="sql" style={github}>
            {this.props.rawSql}
          </SyntaxHighlighter>
        </div>
      );
    }
    this.setState({
      modalBody: (
        <div>
          <h4>{t('Source SQL')}</h4>
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
        modalTitle={t('SQL')}
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
