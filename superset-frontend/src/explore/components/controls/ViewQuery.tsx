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
import { useSelector } from 'react-redux';
import rison from 'rison';
import { styled, SupersetClient, t, useTheme } from '@superset-ui/core';
import {
  Icons,
  Switch,
  Button,
  Skeleton,
  Card,
  Space,
} from '@superset-ui/core/components';
import { CopyToClipboard } from 'src/components';
import { RootState } from 'src/dashboard/types';
import { findPermission } from 'src/utils/findPermission';
import CodeSyntaxHighlighter, {
  SupportedLanguage,
  preloadLanguages,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { useHistory } from 'react-router-dom';

export interface ViewQueryProps {
  sql: string;
  datasource: string;
  language?: SupportedLanguage;
}

const StyledSyntaxContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const StyledThemedSyntaxHighlighter = styled(CodeSyntaxHighlighter)`
  flex: 1;
`;

const StyledFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DATASET_BACKEND_QUERY = {
  keys: ['none'],
  columns: ['database.backend'],
};

const ViewQuery: FC<ViewQueryProps> = props => {
  const { sql, language = 'sql', datasource } = props;
  const theme = useTheme();
  const datasetId = datasource.split('__')[0];
  const [formattedSQL, setFormattedSQL] = useState<string>();
  const [showFormatSQL, setShowFormatSQL] = useState(true);
  const history = useHistory();
  const currentSQL = (showFormatSQL ? formattedSQL : sql) ?? sql;
  const canAccessSQLLab = useSelector((state: RootState) =>
    findPermission('menu_access', 'SQL Lab', state.user?.roles),
  );

  // Preload the language when component mounts to ensure smooth experience
  useEffect(() => {
    preloadLanguages([language]);
  }, [language]);

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
    <Card bodyStyle={{ padding: theme.sizeUnit * 4 }}>
      <StyledSyntaxContainer key={sql}>
        {!formattedSQL && <Skeleton active />}
        {formattedSQL && (
          <StyledThemedSyntaxHighlighter
            language={language}
            customStyle={{ flex: 1, marginBottom: theme.sizeUnit * 3 }}
          >
            {currentSQL}
          </StyledThemedSyntaxHighlighter>
        )}

        <StyledFooter>
          <Space size={theme.sizeUnit * 2}>
            <CopyToClipboard
              text={currentSQL}
              shouldShowText={false}
              copyNode={
                <Button
                  buttonStyle="secondary"
                  buttonSize="small"
                  icon={<Icons.CopyOutlined />}
                >
                  {t('Copy')}
                </Button>
              }
            />
            {canAccessSQLLab && (
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                onClick={navToSQLLab}
              >
                {t('View in SQL Lab')}
              </Button>
            )}
          </Space>

          <Space size={theme.sizeUnit * 2} align="center">
            <Icons.ConsoleSqlOutlined />
            <Switch
              id="formatSwitch"
              checked={showFormatSQL}
              onChange={formatCurrentQuery}
              checkedChildren={t('formatted')}
              unCheckedChildren={t('original')}
            />
          </Space>
        </StyledFooter>
      </StyledSyntaxContainer>
    </Card>
  );
};

export default ViewQuery;
