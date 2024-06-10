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
import { FC } from 'react';
import { styled } from '@superset-ui/core';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { CopyButton } from 'src/explore/components/DataTableControl';
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

interface ViewQueryProps {
  sql: string;
  language?: string;
}

const StyledSyntaxContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)`
  flex: 1;
`;

const ViewQuery: FC<ViewQueryProps> = props => {
  const { sql, language = 'sql' } = props;
  return (
    <StyledSyntaxContainer key={sql}>
      <CopyToClipboard
        text={sql}
        shouldShowText={false}
        copyNode={
          <CopyButtonViewQuery buttonSize="xsmall">
            <i className="fa fa-clipboard" />
          </CopyButtonViewQuery>
        }
      />
      <StyledSyntaxHighlighter language={language} style={github}>
        {sql}
      </StyledSyntaxHighlighter>
    </StyledSyntaxContainer>
  );
};

export default ViewQuery;
