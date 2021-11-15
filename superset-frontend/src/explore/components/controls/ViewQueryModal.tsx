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
import React, { useEffect, useState } from 'react';
import { ensureIsArray, styled, t } from '@superset-ui/core';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import CopyToClipboard from 'src/components/CopyToClipboard';
import Loading from 'src/components/Loading';
import { CopyButton } from 'src/explore/components/DataTableControl';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { getChartDataRequest } from 'src/chart/chartAction';
import markdownSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/markdown';
import htmlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/htmlbars';
import sqlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import jsonSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/json';

const CopyButtonViewQuery = styled(CopyButton)`
  && {
    margin: 0 0 ${({ theme }) => theme.gridUnit}px;
  }
`;

SyntaxHighlighter.registerLanguage('markdown', markdownSyntax);
SyntaxHighlighter.registerLanguage('html', htmlSyntax);
SyntaxHighlighter.registerLanguage('sql', sqlSyntax);
SyntaxHighlighter.registerLanguage('json', jsonSyntax);

interface Props {
  latestQueryFormData: object;
}

type Result = {
  query: string;
  language: string;
};

const StyledSyntaxContainer = styled.div`
  height: 100%;
`;

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)`
  height: calc(100% - 26px); // 100% - clipboard height
`;

const ViewQueryModal: React.FC<Props> = props => {
  const [result, setResult] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChartData = (resultType: string) => {
    setIsLoading(true);
    getChartDataRequest({
      formData: props.latestQueryFormData,
      resultFormat: 'json',
      resultType,
    })
      .then(({ json }) => {
        setResult(ensureIsArray(json.result));
        setIsLoading(false);
        setError(null);
      })
      .catch(response => {
        getClientErrorObject(response).then(({ error, message }) => {
          setError(
            error ||
              message ||
              response.statusText ||
              t('Sorry, An error occurred'),
          );
          setIsLoading(false);
        });
      });
  };
  useEffect(() => {
    loadChartData('query');
  }, [JSON.stringify(props.latestQueryFormData)]);

  if (isLoading) {
    return <Loading />;
  }
  if (error) {
    return <pre>{error}</pre>;
  }
  return (
    <>
      {result.map(item =>
        item.query ? (
          <StyledSyntaxContainer key={item.query}>
            <CopyToClipboard
              text={item.query}
              shouldShowText={false}
              copyNode={
                <CopyButtonViewQuery buttonSize="xsmall">
                  <i className="fa fa-clipboard" />
                </CopyButtonViewQuery>
              }
            />
            <StyledSyntaxHighlighter
              language={item.language || undefined}
              style={github}
            >
              {item.query}
            </StyledSyntaxHighlighter>
          </StyledSyntaxContainer>
        ) : null,
      )}
    </>
  );
};

export default ViewQueryModal;
