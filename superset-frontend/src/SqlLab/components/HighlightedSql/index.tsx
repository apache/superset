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
import { styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { ModalTrigger } from '@superset-ui/core/components';
import CodeSyntaxHighlighter from '@superset-ui/core/components/CodeSyntaxHighlighter';

export interface HighlightedSqlProps {
  sql: string;
  rawSql?: string;
  maxWidth?: number;
  maxLines?: number;
  shrink?: any;
}

interface HighlightedSqlModalTypes {
  rawSql?: string;
  sql: string;
}

interface TriggerNodeProps {
  shrink: boolean;
  sql: string;
  maxLines: number;
  maxWidth: number;
}

const Title = styled.h4`
  font-size: ${({ theme }) => theme.fontSizeLG}px;
  margin: ${({ theme }) => theme.sizeUnit * 2}px 0;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

const shrinkSql = (sql: string, maxLines: number, maxWidth: number) => {
  const ssql = sql || '';
  let lines = ssql.split('\n');
  if (lines.length >= maxLines) {
    lines = lines.slice(0, maxLines);
    lines.push('{...}');
  }
  return lines
    .map(line =>
      line.length > maxWidth ? `${line.slice(0, maxWidth)}{...}` : line,
    )
    .join('\n');
};

function TriggerNode({ shrink, sql, maxLines, maxWidth }: TriggerNodeProps) {
  return (
    <CodeSyntaxHighlighter language="sql">
      {shrink ? shrinkSql(sql, maxLines, maxWidth) : sql}
    </CodeSyntaxHighlighter>
  );
}

function HighlightSqlModal({ rawSql, sql }: HighlightedSqlModalTypes) {
  const theme = useTheme();
  const codeBlockStyle = {
    border: 1,
    borderColor: theme.colorBorder,
    borderStyle: 'solid',
    backgroundColor: theme.colorBgLayout,
    fontSize: theme.fontSize * 0.9,
    padding: theme.sizeUnit * 2,
  };

  return (
    <div>
      <Title>{t('Source SQL')}</Title>
      <CodeSyntaxHighlighter language="sql" customStyle={codeBlockStyle}>
        {sql}
      </CodeSyntaxHighlighter>
      {rawSql && rawSql !== sql && (
        <div>
          <Title>{t('Executed SQL')}</Title>
          <CodeSyntaxHighlighter language="sql" customStyle={codeBlockStyle}>
            {rawSql}
          </CodeSyntaxHighlighter>
        </div>
      )}
    </div>
  );
}

function HighlightedSql({
  sql,
  rawSql,
  maxWidth = 50,
  maxLines = 5,
  shrink = false,
}: HighlightedSqlProps) {
  return (
    <ModalTrigger
      modalTitle={t('SQL')}
      modalBody={<HighlightSqlModal rawSql={rawSql} sql={sql} />}
      triggerNode={
        <TriggerNode
          shrink={shrink}
          sql={sql}
          maxLines={maxLines}
          maxWidth={maxWidth}
        />
      }
      responsive
    />
  );
}

export default HighlightedSql;
