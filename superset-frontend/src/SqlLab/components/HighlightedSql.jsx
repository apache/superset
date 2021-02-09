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
import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { t } from '@superset-ui/core';

import ModalTrigger from '../../components/ModalTrigger';

SyntaxHighlighter.registerLanguage('sql', sql);

const propTypes = {
  sql: PropTypes.string.isRequired,
  rawSql: PropTypes.string,
  maxWidth: PropTypes.number,
  maxLines: PropTypes.number,
  shrink: PropTypes.bool,
};

function HighlightedSql({
  sql,
  rawSql,
  maxWidth = 50,
  maxLines = 5,
  shrink = false,
}) {
  const [modalBody, setModalBody] = useState(null);

  const shrinkSql = useCallback(() => {
    const ssql = sql || '';
    let lines = ssql.split('\n');
    if (lines.length >= maxLines) {
      lines = lines.slice(0, maxLines);
      lines.push('{...}');
    }
    return lines
      .map(line => {
        if (line.length > maxWidth) {
          return `${line.slice(0, maxWidth)}{...}`;
        }
        return line;
      })
      .join('\n');
  }, [maxLines, maxWidth, sql]);

  const triggerNode = useCallback(() => {
    const shownSql = shrink ? shrinkSql(sql) : sql;
    return (
      <SyntaxHighlighter language="sql" style={github}>
        {shownSql}
      </SyntaxHighlighter>
    );
  }, [shrink, shrinkSql, sql]);

  const generateModal = useCallback(() => {
    let internalRawSql;
    if (rawSql && rawSql !== sql) {
      internalRawSql = (
        <div>
          <h4>{t('Raw SQL')}</h4>
          <SyntaxHighlighter language="sql" style={github}>
            {rawSql}
          </SyntaxHighlighter>
        </div>
      );
    }
    setModalBody(
      <div>
        <h4>{t('Source SQL')}</h4>
        <SyntaxHighlighter language="sql" style={github}>
          {sql}
        </SyntaxHighlighter>
        {internalRawSql}
      </div>,
    );
  }, [rawSql, sql]);

  const [modalTrigger, setModalTrigger] = useState(
    <ModalTrigger
      modalTitle={t('SQL')}
      triggerNode={triggerNode()}
      modalBody={modalBody}
      beforeOpen={() => generateModal()}
    />,
  );

  useEffect(() => {
    setModalTrigger(
      <ModalTrigger
        modalTitle={t('SQL')}
        triggerNode={triggerNode()}
        modalBody={modalBody}
        beforeOpen={generateModal}
      />,
    );
  }, [triggerNode, modalBody, generateModal]);

  return modalTrigger;
}
HighlightedSql.propTypes = propTypes;

export default HighlightedSql;
