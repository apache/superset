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
import {
  FC,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import rison from 'rison';
import { styled, SupersetClient, t } from '@superset-ui/core';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { Icons, Switch, Button, Skeleton } from '@superset-ui/core/components';
import { CopyToClipboard } from 'src/components';
import { CopyButton } from 'src/explore/components/DataTableControl';
import markdownSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/markdown';
import htmlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/htmlbars';
import sqlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import jsonSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/json';
import { useHistory } from 'react-router-dom';

const CopyButtonViewQuery = styled(CopyButton)`
  ${({ theme }) => `
		&& {
			margin: 0 0 ${theme.sizeUnit}px;
		}
  `}
`;

SyntaxHighlighter.registerLanguage('markdown', markdownSyntax);
SyntaxHighlighter.registerLanguage('html', htmlSyntax);
SyntaxHighlighter.registerLanguage('sql', sqlSyntax);
SyntaxHighlighter.registerLanguage('json', jsonSyntax);

export interface ViewQueryProps {
  sql: string;
  datasource: string;
  language?: string;
}

const StyledSyntaxContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const StyledHeaderMenuContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-top: ${({ theme }) => -theme.sizeUnit * 4}px;
  align-items: flex-end;
`;

const StyledHeaderActionContainer = styled.div`
  display: flex;
  flex-direction: row;
  column-gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)`
  flex: 1;
`;

const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSize}px;
`;

const DATASET_BACKEND_QUERY = {
  keys: ['none'],
  columns: ['database.backend'],
};

const ViewQuery: FC<ViewQueryProps> = props => {
  const { sql, language = 'sql', datasource } = props;
  const datasetId = datasource.split('__')[0];
  const [formattedSQL, setFormattedSQL] = useState<string>();
  const [showFormatSQL, setShowFormatSQL] = useState(true);
  const history = useHistory();
  const currentSQL = (showFormatSQL ? formattedSQL : sql) ?? sql;

  const formatCurrentQuery = useCallback(() => {
    if (formattedSQL) {
      setShowFormatSQL(val => !val);
    } else {
      const queryParams = rison.encode(DATASET_BACKEND_QUERY);
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${datasetId}?q=${queryParams}`,
      })
        .then(({ json }) =>
          SupersetClient.post({
            endpoint: `/api/v1/sqllab/format_sql/`,
            body: JSON.stringify({
              sql,
              engine: json.result.database.backend,
            }),
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .then(({ json }) => {
          setFormattedSQL(json.result);
          setShowFormatSQL(true);
        })
        .catch(() => {
          setShowFormatSQL(true);
        });
    }
  }, [sql, datasetId, formattedSQL]);

  const navToSQLLab = useCallback(
    (domEvent: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
      const requestedQuery = {
        datasourceKey: datasource,
        sql: currentSQL,
      };
      if (domEvent.metaKey || domEvent.ctrlKey) {
        domEvent.preventDefault();
        window.open(
          `/sqllab?datasourceKey=${datasource}&sql=${currentSQL}`,
          '_blank',
        );
      } else {
        history.push('/sqllab', { state: { requestedQuery } });
      }
    },
    [history, datasource, currentSQL],
  );

  useEffect(() => {
    formatCurrentQuery();
  }, [sql]);

  return (
    <StyledSyntaxContainer key={sql}>
      <StyledHeaderMenuContainer>
        <StyledHeaderActionContainer>
          <CopyToClipboard
            text={currentSQL}
            shouldShowText={false}
            copyNode={
              <CopyButtonViewQuery
                buttonSize="small"
                icon={<Icons.CopyOutlined />}
              >
                {t('Copy')}
              </CopyButtonViewQuery>
            }
          />
          <Button onClick={navToSQLLab}>{t('View in SQL Lab')}</Button>
        </StyledHeaderActionContainer>
        <StyledHeaderActionContainer>
          <Switch
            id="formatSwitch"
            checked={!showFormatSQL}
            onChange={formatCurrentQuery}
          />
          <StyledLabel htmlFor="formatSwitch">
            {t('Show original SQL')}
          </StyledLabel>
        </StyledHeaderActionContainer>
      </StyledHeaderMenuContainer>
      {!formattedSQL && <Skeleton active />}
      {formattedSQL && (
        <StyledSyntaxHighlighter language={language} style={github}>
          {currentSQL}
        </StyledSyntaxHighlighter>
      )}
    </StyledSyntaxContainer>
  );
};

export default ViewQuery;
