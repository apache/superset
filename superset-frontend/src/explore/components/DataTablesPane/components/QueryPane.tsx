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
import { useEffect, useState, useCallback } from 'react';
import { ensureIsArray, t, getClientErrorObject } from '@superset-ui/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import {
  Loading,
  EmptyState,
  Icons,
  Button,
  Space,
} from '@superset-ui/core/components';
import { CopyToClipboard } from 'src/components';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import CodeSyntaxHighlighter, {
  SupportedLanguage,
  preloadLanguages,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { QueryPaneProps } from '../types';

const QueryPaneContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: ${theme.sizeUnit * 4}px;
    overflow: auto;
  `}
`;

const QueryHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${theme.sizeUnit * 3}px;
    flex-shrink: 0;
  `}
`;

const QueryTitle = styled.div`
  ${({ theme }) => css`
    font-weight: ${theme.fontWeightBold};
    color: ${theme.colorTextPrimary};
  `}
`;

const QueryContent = styled.div`
  ${({ theme }) => css`
    flex: 1;
    overflow: auto;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorBgLayout};
  `}
`;

const Error = styled.pre`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit * 4}px;
    color: ${theme.colorError};
  `}
`;

const StyledSyntaxHighlighter = styled(CodeSyntaxHighlighter)`
  ${({ theme }) => css`
    margin: 0 !important;
    padding: ${theme.sizeUnit * 3}px !important;
    height: 100%;
    overflow: auto;

    code {
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

interface QueryResult {
  query?: string;
  language: SupportedLanguage;
  error?: string;
}

export const QueryPane = ({
  isRequest,
  queryFormData,
  isVisible,
}: QueryPaneProps) => {
  const theme = useTheme();
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preload SQL language for syntax highlighting
  useEffect(() => {
    preloadLanguages(['sql']);
  }, []);

  useEffect(() => {
    if (isRequest && isVisible && queryFormData) {
      setIsLoading(true);
      setError(null);

      getChartDataRequest({
        formData: queryFormData,
        resultFormat: 'json',
        resultType: 'query',
      })
        .then(({ json }) => {
          setResults(ensureIsArray(json.result));
          setError(null);
        })
        .catch(response => {
          getClientErrorObject(response).then(({ error, message }) => {
            setError(
              error ||
                message ||
                response.statusText ||
                t('An error occurred while fetching the query'),
            );
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isRequest, isVisible, JSON.stringify(queryFormData)]);

  const getCurrentQuery = useCallback(() => {
    if (results.length === 0) return '';
    return results.map(r => r.query || '').join('\n\n');
  }, [results]);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <QueryPaneContainer>
        <Error>{error}</Error>
      </QueryPaneContainer>
    );
  }

  if (results.length === 0 || !results[0].query) {
    return (
      <EmptyState
        image="document.svg"
        title={t('No query was generated')}
        description={t('Run the query to see the generated SQL')}
      />
    );
  }

  return (
    <QueryPaneContainer>
      <QueryHeader>
        <QueryTitle>{t('Generated SQL')}</QueryTitle>
        <Space size={theme.sizeUnit * 2}>
          <CopyToClipboard
            text={getCurrentQuery()}
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
        </Space>
      </QueryHeader>
      <QueryContent>
        {results.map((result, index) => (
          <div key={index}>
            {result.error && <Error>{result.error}</Error>}
            {result.query && (
              <StyledSyntaxHighlighter language={result.language || 'sql'}>
                {result.query}
              </StyledSyntaxHighlighter>
            )}
          </div>
        ))}
      </QueryContent>
    </QueryPaneContainer>
  );
};
